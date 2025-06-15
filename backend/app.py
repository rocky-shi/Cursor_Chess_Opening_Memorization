from flask import Flask, request, jsonify, send_from_directory, session
from flask_cors import CORS
import chess
import chess.pgn
import io
import re
from typing import Dict, List, Any, Optional
import os
import sqlite3
import json
from datetime import datetime, timedelta
import threading
import hashlib
import secrets
from functools import wraps

app = Flask(__name__)
CORS(app, supports_credentials=True, origins="*")  # 允许跨域请求并支持凭证
app.secret_key = os.environ.get('SECRET_KEY', 'chess-opening-memorization-secret-key-2025')

# 配置会话以支持跨域访问
app.config['SESSION_COOKIE_SAMESITE'] = 'Lax'  # 改为Lax以支持跨域但不太严格
app.config['SESSION_COOKIE_SECURE'] = False  # 对于HTTP连接设为False
app.config['SESSION_COOKIE_HTTPONLY'] = False  # 改为False以便JavaScript访问
app.config['SESSION_COOKIE_DOMAIN'] = None  # 不限制域名

# 数据库配置
DATABASE_PATH = 'chess_pgn.db'
db_lock = threading.Lock()

def hash_password(password: str) -> str:
    """哈希密码"""
    return hashlib.sha256(password.encode()).hexdigest()

def verify_password(password: str, hashed: str) -> bool:
    """验证密码"""
    return hash_password(password) == hashed

def generate_token() -> str:
    """生成会话token"""
    return secrets.token_urlsafe(32)

def init_database():
    """初始化数据库"""
    with db_lock:
        conn = sqlite3.connect(DATABASE_PATH)
        cursor = conn.cursor()
        
        # 创建用户表
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                email TEXT,
                role TEXT DEFAULT 'user',
                is_active BOOLEAN DEFAULT 1,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                last_login DATETIME,
                login_count INTEGER DEFAULT 0
            )
        ''')
        
        # 创建会话表
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS user_sessions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                token TEXT UNIQUE NOT NULL,
                expires_at DATETIME NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users (id)
            )
        ''')
        
        # 创建用户进度表
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS user_progress (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                pgn_game_id INTEGER NOT NULL,
                branch_id TEXT NOT NULL,
                is_completed BOOLEAN DEFAULT 0,
                correct_count INTEGER DEFAULT 0,
                total_attempts INTEGER DEFAULT 0,
                last_attempt_at DATETIME,
                mastery_level INTEGER DEFAULT 0,
                notes TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users (id),
                FOREIGN KEY (pgn_game_id) REFERENCES pgn_games (id),
                UNIQUE(user_id, pgn_game_id, branch_id)
            )
        ''')
        
        # 创建用户学习记录表
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS user_study_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                pgn_game_id INTEGER NOT NULL,
                branch_id TEXT NOT NULL,
                action TEXT NOT NULL,
                result TEXT,
                duration_seconds INTEGER,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users (id),
                FOREIGN KEY (pgn_game_id) REFERENCES pgn_games (id)
            )
        ''')
        
        # 创建PGN存储表
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS pgn_games (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                filename TEXT NOT NULL,
                original_content TEXT NOT NULL,
                parsed_data TEXT NOT NULL,
                upload_time DATETIME DEFAULT CURRENT_TIMESTAMP,
                file_size INTEGER,
                total_branches INTEGER,
                total_games INTEGER,
                uploaded_by INTEGER,
                is_public BOOLEAN DEFAULT 1,
                FOREIGN KEY (uploaded_by) REFERENCES users (id)
            )
        ''')
        
        # 创建默认管理员用户
        cursor.execute('SELECT COUNT(*) FROM users WHERE role = "admin"')
        admin_count = cursor.fetchone()[0]
        
        if admin_count == 0:
            admin_password = hash_password('admin123')
            cursor.execute('''
                INSERT INTO users (username, password_hash, email, role, is_active)
                VALUES (?, ?, ?, ?, ?)
            ''', ('admin', admin_password, 'admin@chess.com', 'admin', 1))
            print("✅ 创建默认管理员账号: admin / admin123")
        
        conn.commit()
        conn.close()

def require_login(f):
    """需要登录的装饰器"""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'user_id' not in session:
            return jsonify({'error': '需要登录', 'require_login': True}), 401
        return f(*args, **kwargs)
    return decorated_function

def require_admin(f):
    """需要管理员权限的装饰器"""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'user_id' not in session:
            return jsonify({'error': '需要登录', 'require_login': True}), 401
        
        user_id = session['user_id']
        with db_lock:
            conn = sqlite3.connect(DATABASE_PATH)
            cursor = conn.cursor()
            cursor.execute('SELECT role FROM users WHERE id = ?', (user_id,))
            user = cursor.fetchone()
            conn.close()
            
            if not user or user[0] != 'admin':
                return jsonify({'error': '需要管理员权限', 'require_admin': True}), 403
        
        return f(*args, **kwargs)
    return decorated_function

def get_current_user():
    """获取当前登录用户信息"""
    if 'user_id' not in session:
        return None
    
    user_id = session['user_id']
    with db_lock:
        conn = sqlite3.connect(DATABASE_PATH)
        cursor = conn.cursor()
        cursor.execute('''
            SELECT id, username, email, role, is_active, created_at, last_login, login_count
            FROM users WHERE id = ?
        ''', (user_id,))
        user = cursor.fetchone()
        conn.close()
        
        if user:
            return {
                'id': user[0],
                'username': user[1],
                'email': user[2],
                'role': user[3],
                'is_active': user[4],
                'created_at': user[5],
                'last_login': user[6],
                'login_count': user[7]
            }
    return None

# 用户认证相关API
@app.route('/api/auth/login', methods=['POST'])
def login():
    """用户登录"""
    try:
        data = request.get_json()
        username = data.get('username', '').strip()
        password = data.get('password', '')
        
        if not username or not password:
            return jsonify({'error': '用户名和密码不能为空'}), 400
        
        with db_lock:
            conn = sqlite3.connect(DATABASE_PATH)
            cursor = conn.cursor()
            
            # 查找用户
            cursor.execute('''
                SELECT id, username, password_hash, email, role, is_active, login_count
                FROM users WHERE username = ?
            ''', (username,))
            user = cursor.fetchone()
            
            if not user:
                return jsonify({'error': '用户名或密码错误'}), 401
            
            user_id, db_username, password_hash, email, role, is_active, login_count = user
            
            # 检查账号是否激活
            if not is_active:
                return jsonify({'error': '账号已被禁用，请联系管理员'}), 401
            
            # 验证密码
            if not verify_password(password, password_hash):
                return jsonify({'error': '用户名或密码错误'}), 401
            
            # 更新登录信息
            cursor.execute('''
                UPDATE users 
                SET last_login = CURRENT_TIMESTAMP, login_count = login_count + 1
                WHERE id = ?
            ''', (user_id,))
            
            conn.commit()
            conn.close()
        
        # 设置会话
        session['user_id'] = user_id
        session['username'] = db_username
        session['role'] = role
        
        return jsonify({
            'success': True,
            'message': '登录成功',
            'user': {
                'id': user_id,
                'username': db_username,
                'email': email,
                'role': role,
                'login_count': login_count + 1
            }
        })
        
    except Exception as e:
        return jsonify({'error': f'登录失败: {str(e)}'}), 500

@app.route('/api/auth/logout', methods=['POST'])
def logout():
    """用户登出"""
    session.clear()
    return jsonify({'success': True, 'message': '登出成功'})

@app.route('/api/auth/register', methods=['POST'])
def register():
    """用户注册"""
    try:
        data = request.get_json()
        username = data.get('username', '').strip()
        password = data.get('password', '')
        email = data.get('email', '').strip()
        
        if not username or not password:
            return jsonify({'error': '用户名和密码不能为空'}), 400
        
        if len(username) < 3:
            return jsonify({'error': '用户名至少3个字符'}), 400
        
        if len(password) < 6:
            return jsonify({'error': '密码至少6个字符'}), 400
        
        with db_lock:
            conn = sqlite3.connect(DATABASE_PATH)
            cursor = conn.cursor()
            
            # 检查用户名是否已存在
            cursor.execute('SELECT id FROM users WHERE username = ?', (username,))
            if cursor.fetchone():
                return jsonify({'error': '用户名已存在'}), 400
            
            # 检查邮箱是否已存在
            if email:
                cursor.execute('SELECT id FROM users WHERE email = ?', (email,))
                if cursor.fetchone():
                    return jsonify({'error': '邮箱已存在'}), 400
            
            # 创建新用户
            password_hash = hash_password(password)
            cursor.execute('''
                INSERT INTO users (username, password_hash, email, role, is_active)
                VALUES (?, ?, ?, ?, ?)
            ''', (username, password_hash, email, 'user', 1))
            
            user_id = cursor.lastrowid
            conn.commit()
            conn.close()
        
        return jsonify({
            'success': True,
            'message': '注册成功',
            'user_id': user_id
        })
        
    except Exception as e:
        return jsonify({'error': f'注册失败: {str(e)}'}), 500

@app.route('/api/auth/me', methods=['GET'])
@require_login
def get_user_info():
    """获取当前用户信息"""
    user = get_current_user()
    if user:
        return jsonify({'success': True, 'user': user})
    return jsonify({'error': '用户信息获取失败'}), 500

# 管理员API
@app.route('/api/admin/users', methods=['GET'])
@require_admin
def get_users():
    """获取用户列表"""
    try:
        with db_lock:
            conn = sqlite3.connect(DATABASE_PATH)
            cursor = conn.cursor()
            
            cursor.execute('''
                SELECT id, username, email, role, is_active, created_at, last_login, login_count
                FROM users ORDER BY created_at DESC
            ''')
            users = cursor.fetchall()
            conn.close()
        
        user_list = []
        for user in users:
            user_list.append({
                'id': user[0],
                'username': user[1],
                'email': user[2],
                'role': user[3],
                'is_active': user[4],
                'created_at': user[5],
                'last_login': user[6],
                'login_count': user[7]
            })
        
        return jsonify({'success': True, 'users': user_list})
        
    except Exception as e:
        return jsonify({'error': f'获取用户列表失败: {str(e)}'}), 500

@app.route('/api/admin/users', methods=['POST'])
@require_admin
def create_user():
    """创建新用户"""
    try:
        data = request.get_json()
        username = data.get('username', '').strip()
        password = data.get('password', '')
        email = data.get('email', '').strip()
        role = data.get('role', 'user')
        
        if not username or not password:
            return jsonify({'error': '用户名和密码不能为空'}), 400
        
        if role not in ['user', 'admin']:
            return jsonify({'error': '权限角色无效'}), 400
        
        with db_lock:
            conn = sqlite3.connect(DATABASE_PATH)
            cursor = conn.cursor()
            
            # 检查用户名是否已存在
            cursor.execute('SELECT id FROM users WHERE username = ?', (username,))
            if cursor.fetchone():
                return jsonify({'error': '用户名已存在'}), 400
            
            # 创建新用户
            password_hash = hash_password(password)
            cursor.execute('''
                INSERT INTO users (username, password_hash, email, role, is_active)
                VALUES (?, ?, ?, ?, ?)
            ''', (username, password_hash, email, role, 1))
            
            user_id = cursor.lastrowid
            conn.commit()
            conn.close()
        
        return jsonify({
            'success': True,
            'message': '用户创建成功',
            'user_id': user_id
        })
        
    except Exception as e:
        return jsonify({'error': f'创建用户失败: {str(e)}'}), 500

@app.route('/api/admin/users/<int:user_id>', methods=['PUT'])
@require_admin
def update_user(user_id):
    """更新用户信息"""
    try:
        data = request.get_json()
        username = data.get('username', '').strip()
        email = data.get('email', '').strip()
        role = data.get('role', 'user')
        is_active = data.get('is_active', True)
        new_password = data.get('password', '').strip()
        
        if role not in ['user', 'admin']:
            return jsonify({'error': '权限角色无效'}), 400
        
        with db_lock:
            conn = sqlite3.connect(DATABASE_PATH)
            cursor = conn.cursor()
            
            # 检查用户是否存在
            cursor.execute('SELECT id FROM users WHERE id = ?', (user_id,))
            if not cursor.fetchone():
                return jsonify({'error': '用户不存在'}), 404
            
            # 检查用户名是否已被其他用户使用
            if username:
                cursor.execute('SELECT id FROM users WHERE username = ? AND id != ?', (username, user_id))
                if cursor.fetchone():
                    return jsonify({'error': '用户名已存在'}), 400
            
            # 构建更新SQL
            update_fields = []
            update_values = []
            
            if username:
                update_fields.append('username = ?')
                update_values.append(username)
            
            if email is not None:
                update_fields.append('email = ?')
                update_values.append(email)
            
            update_fields.append('role = ?')
            update_values.append(role)
            
            update_fields.append('is_active = ?')
            update_values.append(is_active)
            
            if new_password:
                update_fields.append('password_hash = ?')
                update_values.append(hash_password(new_password))
            
            update_values.append(user_id)
            
            sql = f"UPDATE users SET {', '.join(update_fields)} WHERE id = ?"
            cursor.execute(sql, update_values)
            
            conn.commit()
            conn.close()
        
        return jsonify({'success': True, 'message': '用户更新成功'})
        
    except Exception as e:
        return jsonify({'error': f'更新用户失败: {str(e)}'}), 500

@app.route('/api/admin/users/<int:user_id>', methods=['DELETE'])
@require_admin
def delete_user(user_id):
    """删除用户"""
    try:
        # 防止删除管理员自己
        if session.get('user_id') == user_id:
            return jsonify({'error': '不能删除自己的账号'}), 400
        
        with db_lock:
            conn = sqlite3.connect(DATABASE_PATH)
            cursor = conn.cursor()
            
            # 检查用户是否存在
            cursor.execute('SELECT id FROM users WHERE id = ?', (user_id,))
            if not cursor.fetchone():
                return jsonify({'error': '用户不存在'}), 404
            
            # 删除用户相关数据
            cursor.execute('DELETE FROM user_sessions WHERE user_id = ?', (user_id,))
            cursor.execute('DELETE FROM user_progress WHERE user_id = ?', (user_id,))
            cursor.execute('DELETE FROM user_study_logs WHERE user_id = ?', (user_id,))
            cursor.execute('DELETE FROM users WHERE id = ?', (user_id,))
            
            conn.commit()
            conn.close()
        
        return jsonify({'success': True, 'message': '用户删除成功'})
        
    except Exception as e:
        return jsonify({'error': f'删除用户失败: {str(e)}'}), 500

# 用户进度相关API
@app.route('/api/progress/my', methods=['GET'])
@require_login
def get_my_progress():
    """获取当前用户的学习进度"""
    try:
        user_id = session['user_id']
        
        with db_lock:
            conn = sqlite3.connect(DATABASE_PATH)
            cursor = conn.cursor()
            
            # 获取用户进度
            cursor.execute('''
                SELECT 
                    up.pgn_game_id,
                    up.branch_id,
                    up.is_completed,
                    up.correct_count,
                    up.total_attempts,
                    up.last_attempt_at,
                    up.mastery_level,
                    up.notes,
                    pg.filename
                FROM user_progress up
                JOIN pgn_games pg ON up.pgn_game_id = pg.id
                WHERE up.user_id = ?
                ORDER BY up.updated_at DESC
            ''', (user_id,))
            
            progress_data = cursor.fetchall()
            conn.close()
        
        progress_list = []
        for row in progress_data:
            progress_list.append({
                'pgn_game_id': row[0],
                'branch_id': row[1],
                'is_completed': row[2],
                'correct_count': row[3],
                'total_attempts': row[4],
                'last_attempt_at': row[5],
                'mastery_level': row[6],
                'notes': row[7],
                'pgn_filename': row[8]
            })
        
        return jsonify({'success': True, 'progress': progress_list})
        
    except Exception as e:
        return jsonify({'error': f'获取进度失败: {str(e)}'}), 500

@app.route('/api/progress/update', methods=['POST'])
@require_login
def update_progress():
    """更新学习进度"""
    try:
        data = request.get_json()
        user_id = session['user_id']
        pgn_game_id = data.get('pgn_game_id')
        branch_id = data.get('branch_id')
        is_correct = data.get('is_correct', False)
        is_branch_end = data.get('is_branch_end', False)  # 新增：是否到达分支最后一步
        duration = data.get('duration', 0)
        notes = data.get('notes', '')
        
        if not pgn_game_id or not branch_id:
            return jsonify({'error': 'PGN游戏ID和分支ID不能为空'}), 400
        
        with db_lock:
            conn = sqlite3.connect(DATABASE_PATH)
            cursor = conn.cursor()
            
            # 检查是否已有进度记录
            cursor.execute('''
                SELECT id, correct_count, total_attempts, mastery_level, is_completed
                FROM user_progress 
                WHERE user_id = ? AND pgn_game_id = ? AND branch_id = ?
            ''', (user_id, pgn_game_id, branch_id))
            
            existing = cursor.fetchone()
            
            if existing:
                # 更新现有记录
                progress_id, correct_count, total_attempts, mastery_level, current_is_completed = existing
                new_correct_count = correct_count + (1 if is_correct else 0)
                new_total_attempts = total_attempts + 1
                
                # 计算掌握度（正确率）
                new_mastery_level = int((new_correct_count / new_total_attempts) * 100)
                
                # 修复的完成判断逻辑：
                # 1. 如果已经完成，保持完成状态
                # 2. 如果未完成，只有走到分支最后一步且这次操作正确才标记为完成
                if current_is_completed:
                    is_completed = True  # 保持已完成状态
                else:
                    is_completed = (is_branch_end and is_correct)  # 新完成判断
                
                cursor.execute('''
                    UPDATE user_progress 
                    SET correct_count = ?, total_attempts = ?, mastery_level = ?,
                        is_completed = ?, last_attempt_at = CURRENT_TIMESTAMP,
                        updated_at = CURRENT_TIMESTAMP, notes = ?
                    WHERE id = ?
                ''', (new_correct_count, new_total_attempts, new_mastery_level, 
                      is_completed, notes, progress_id))
            else:
                # 创建新记录
                correct_count = 1 if is_correct else 0
                total_attempts = 1
                mastery_level = 100 if is_correct else 0
                # 新记录的完成判断：第一次就到分支末尾且正确才算完成
                is_completed = (is_branch_end and is_correct)
                
                cursor.execute('''
                    INSERT INTO user_progress 
                    (user_id, pgn_game_id, branch_id, is_completed, correct_count, 
                     total_attempts, last_attempt_at, mastery_level, notes)
                    VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, ?, ?)
                ''', (user_id, pgn_game_id, branch_id, is_completed, 
                      correct_count, total_attempts, mastery_level, notes))
            
            # 记录学习日志
            cursor.execute('''
                INSERT INTO user_study_logs 
                (user_id, pgn_game_id, branch_id, action, result, duration_seconds)
                VALUES (?, ?, ?, ?, ?, ?)
            ''', (user_id, pgn_game_id, branch_id, 'practice', 
                  'correct' if is_correct else 'incorrect', duration))
            
            conn.commit()
            conn.close()
        
        return jsonify({'success': True, 'message': '进度更新成功'})
        
    except Exception as e:
        return jsonify({'error': f'更新进度失败: {str(e)}'}), 500

@app.route('/api/progress/stats', methods=['GET'])
@require_login
def get_progress_stats():
    """获取学习统计信息"""
    try:
        user_id = session['user_id']
        
        with db_lock:
            conn = sqlite3.connect(DATABASE_PATH)
            cursor = conn.cursor()
            
            # 总体统计
            cursor.execute('''
                SELECT 
                    COUNT(*) as total_branches,
                    SUM(CASE WHEN is_completed = 1 THEN 1 ELSE 0 END) as completed_branches,
                    SUM(correct_count) as total_correct,
                    SUM(total_attempts) as total_attempts,
                    AVG(mastery_level) as avg_mastery
                FROM user_progress 
                WHERE user_id = ?
            ''', (user_id,))
            
            stats = cursor.fetchone()
            
            # 最近学习记录
            cursor.execute('''
                SELECT DATE(created_at) as date, COUNT(*) as count
                FROM user_study_logs 
                WHERE user_id = ? AND created_at >= date('now', '-30 days')
                GROUP BY DATE(created_at)
                ORDER BY date DESC
                LIMIT 30
            ''', (user_id,))
            
            daily_stats = cursor.fetchall()
            conn.close()
        
        if stats:
            total_branches, completed_branches, total_correct, total_attempts, avg_mastery = stats
            completion_rate = (completed_branches / total_branches * 100) if total_branches > 0 else 0
            accuracy_rate = (total_correct / total_attempts * 100) if total_attempts > 0 else 0
            
            return jsonify({
                'success': True,
                'stats': {
                    'total_branches': total_branches or 0,
                    'completed_branches': completed_branches or 0,
                    'completion_rate': round(completion_rate, 2),
                    'total_correct': total_correct or 0,
                    'total_attempts': total_attempts or 0,
                    'accuracy_rate': round(accuracy_rate, 2),
                    'avg_mastery': round(avg_mastery or 0, 2)
                },
                'daily_stats': [{'date': row[0], 'count': row[1]} for row in daily_stats]
            })
        else:
            return jsonify({
                'success': True,
                'stats': {
                    'total_branches': 0,
                    'completed_branches': 0,
                    'completion_rate': 0,
                    'total_correct': 0,
                    'total_attempts': 0,
                    'accuracy_rate': 0,
                    'avg_mastery': 0
                },
                'daily_stats': []
            })
        
    except Exception as e:
        return jsonify({'error': f'获取统计信息失败: {str(e)}'}), 500

@app.route('/api/progress/reset', methods=['POST'])
@require_login
def reset_progress():
    """重置学习进度（只重置未掌握的分支，保留已掌握分支）"""
    try:
        data = request.get_json()
        user_id = session['user_id']
        pgn_game_id = data.get('pgn_game_id')
        
        if not pgn_game_id:
            return jsonify({'error': 'PGN游戏ID不能为空'}), 400
        
        with db_lock:
            conn = sqlite3.connect(DATABASE_PATH)
            cursor = conn.cursor()
            
            # 只删除未掌握的分支进度记录（未完成或有错误的分支）
            cursor.execute('''
                DELETE FROM user_progress 
                WHERE user_id = ? AND pgn_game_id = ? 
                AND (is_completed = 0 OR (correct_count * 1.0 / total_attempts) < 1.0)
            ''', (user_id, pgn_game_id))
            
            reset_count = cursor.rowcount
            
            # 删除对应的学习日志（只删除未掌握分支的日志）
            cursor.execute('''
                DELETE FROM user_study_logs 
                WHERE user_id = ? AND pgn_game_id = ? 
                AND branch_id NOT IN (
                    SELECT branch_id FROM user_progress 
                    WHERE user_id = ? AND pgn_game_id = ? 
                    AND is_completed = 1 AND (correct_count * 1.0 / total_attempts) = 1.0
                )
            ''', (user_id, pgn_game_id, user_id, pgn_game_id))
            
            conn.commit()
            conn.close()
        
        return jsonify({
            'success': True,
            'message': f'已重置未掌握分支的进度记录 {reset_count} 条，已掌握分支保留'
        })
        
    except Exception as e:
        return jsonify({'error': f'重置进度失败: {str(e)}'}), 500

@app.route('/api/progress/current-stats/<int:pgn_id>', methods=['GET'])
@require_login
def get_current_stats(pgn_id):
    """获取当前PGN的实时统计（包含数据库记录和当前背诵过程）"""
    try:
        user_id = session['user_id']
        
        with db_lock:
            conn = sqlite3.connect(DATABASE_PATH)
            cursor = conn.cursor()
            
            # 获取数据库中的统计数据
            cursor.execute('''
                SELECT 
                    SUM(correct_count) as total_correct,
                    SUM(total_attempts) as total_attempts
                FROM user_progress 
                WHERE user_id = ? AND pgn_game_id = ?
            ''', (user_id, pgn_id))
            
            db_stats = cursor.fetchone()
            conn.close()
        
        total_correct = db_stats[0] or 0
        total_attempts = db_stats[1] or 0
        
        # 计算整体正确率
        accuracy_rate = (total_correct / total_attempts * 100) if total_attempts > 0 else 0
        
        return jsonify({
            'success': True,
            'total_correct': total_correct,
            'total_attempts': total_attempts,
            'accuracy_rate': round(accuracy_rate, 1)
        })
        
    except Exception as e:
        return jsonify({'error': f'获取当前统计失败: {str(e)}'}), 500

@app.route('/api/progress/by-pgn', methods=['GET'])
@require_login
def get_progress_by_pgn():
    """获取按PGN分组的学习进度统计"""
    try:
        user_id = session['user_id']
        
        with db_lock:
            conn = sqlite3.connect(DATABASE_PATH)
            cursor = conn.cursor()
            
            # 获取用户所有已练习的PGN的统计信息
            cursor.execute('''
                SELECT 
                    pg.id,
                    pg.filename,
                    pg.total_branches,
                    COUNT(up.id) as practiced_branches,
                    SUM(CASE WHEN up.is_completed = 1 THEN 1 ELSE 0 END) as completed_branches,
                    SUM(up.correct_count) as total_correct,
                    SUM(up.total_attempts) as total_attempts,
                    AVG(up.mastery_level) as avg_mastery,
                    MAX(up.last_attempt_at) as last_practice_time,
                    pg.upload_time
                FROM pgn_games pg
                LEFT JOIN user_progress up ON pg.id = up.pgn_game_id AND up.user_id = ?
                WHERE EXISTS (
                    SELECT 1 FROM user_progress 
                    WHERE pgn_game_id = pg.id AND user_id = ?
                )
                GROUP BY pg.id, pg.filename, pg.total_branches, pg.upload_time
                ORDER BY last_practice_time DESC
            ''', (user_id, user_id))
            
            pgn_stats = cursor.fetchall()
            conn.close()
        
        result = []
        for row in pgn_stats:
            pgn_id, filename, total_branches, practiced_branches, completed_branches, total_correct, total_attempts, avg_mastery, last_practice_time, upload_time = row
            
            # 计算统计数据
            completion_rate = (completed_branches / total_branches * 100) if total_branches > 0 else 0
            
            # 计算整体正确率：包含历史已背完分支和当前背诵分支的合并统计
            # 这里的total_correct和total_attempts已经包含了所有分支的累计数据
            accuracy_rate = (total_correct / total_attempts * 100) if total_attempts > 0 else 0
            
            # 重新计算掌握度：需要查询每个分支的详细情况
            with db_lock:
                conn = sqlite3.connect(DATABASE_PATH)
                cursor = conn.cursor()
                
                # 获取该PGN下所有分支的完成情况和正确率
                cursor.execute('''
                    SELECT 
                        is_completed,
                        correct_count,
                        total_attempts
                    FROM user_progress 
                    WHERE user_id = ? AND pgn_game_id = ?
                ''', (session['user_id'], pgn_id))
                
                branch_details = cursor.fetchall()
                conn.close()
            
            # 计算真正掌握的分支数（完成且100%正确）
            mastered_branches = 0
            for is_completed, correct_count, total_attempts in branch_details:
                if is_completed and total_attempts > 0 and (correct_count / total_attempts) == 1.0:
                    mastered_branches += 1
            
            # 计算掌握度百分比
            mastery_rate = (mastered_branches / total_branches * 100) if total_branches > 0 else 0
            
            # 确定整体状态
            if mastery_rate >= 80:
                status = "已掌握"
                status_class = "completed"
            elif completion_rate >= 50:
                status = "学习中"
                status_class = "learning"
            elif completion_rate > 0:
                status = "初学"
                status_class = "beginner"
            else:
                status = "未开始"
                status_class = "not-started"
            
            result.append({
                'pgn_id': pgn_id,
                'filename': filename,
                'total_branches': total_branches or 0,
                'practiced_branches': practiced_branches or 0,
                'completed_branches': completed_branches or 0,
                'mastered_branches': mastered_branches,  # 新增：真正掌握的分支数
                'completion_rate': round(completion_rate, 1),
                'mastery_rate': round(mastery_rate, 1),  # 新增：掌握度百分比
                'total_correct': total_correct or 0,
                'total_attempts': total_attempts or 0,
                'accuracy_rate': round(accuracy_rate, 1),
                'avg_mastery': round(mastery_rate, 1),  # 使用新的掌握度计算
                'last_practice_time': last_practice_time,
                'upload_time': upload_time,
                'status': status,
                'status_class': status_class,
                'notes': ''  # 可以后续添加备注功能
            })
        
        return jsonify({'success': True, 'pgn_progress': result})
        
    except Exception as e:
        return jsonify({'error': f'获取PGN进度统计失败: {str(e)}'}), 500

@app.route('/api/progress/branches/<int:pgn_id>', methods=['GET'])
@require_login
def get_branches_progress(pgn_id):
    """获取指定PGN的所有分支详细进度"""
    try:
        user_id = session['user_id']
        
        with db_lock:
            conn = sqlite3.connect(DATABASE_PATH)
            cursor = conn.cursor()
            
            # 获取该PGN的所有分支进度
            cursor.execute('''
                SELECT 
                    up.branch_id,
                    up.is_completed,
                    up.correct_count,
                    up.total_attempts,
                    up.last_attempt_at,
                    up.mastery_level,
                    up.notes
                FROM user_progress up
                WHERE up.user_id = ? AND up.pgn_game_id = ?
                ORDER BY up.branch_id
            ''', (user_id, pgn_id))
            
            branches = cursor.fetchall()
            
            # 获取PGN文件名
            cursor.execute('SELECT filename FROM pgn_games WHERE id = ?', (pgn_id,))
            pgn_info = cursor.fetchone()
            
            conn.close()
        
        if not pgn_info:
            return jsonify({'error': 'PGN文件不存在'}), 404
        
        result = []
        for row in branches:
            branch_id, is_completed, correct_count, total_attempts, last_attempt_at, mastery_level, notes = row
            accuracy = (correct_count / total_attempts * 100) if total_attempts > 0 else 0
            
            # 计算掌握度：只有完成分支且全部正确时才是100%，否则为0%
            if is_completed and accuracy == 100:
                calculated_mastery = 100
                status = "已掌握"
                status_class = "completed"
            elif is_completed and accuracy < 100:
                calculated_mastery = 0  # 完成了但有错误，掌握度为0%
                status = "需复习"
                status_class = "learning"
            elif total_attempts > 0:
                calculated_mastery = 0  # 还在学习中，掌握度为0%
                status = "学习中"
                status_class = "learning"
            else:
                calculated_mastery = 0  # 未开始
                status = "未开始"
                status_class = "not-started"
            
            result.append({
                'branch_id': branch_id,
                'is_completed': is_completed,
                'correct_count': correct_count or 0,
                'total_attempts': total_attempts or 0,
                'accuracy_rate': round(accuracy, 1),
                'mastery_level': calculated_mastery,  # 使用新的掌握度计算
                'last_attempt_at': last_attempt_at,
                'notes': notes or '',
                'status': status,
                'status_class': status_class
            })
        
        return jsonify({
            'success': True, 
            'pgn_filename': pgn_info[0],
            'branches': result
        })
        
    except Exception as e:
        return jsonify({'error': f'获取分支进度失败: {str(e)}'}), 500

@app.route('/api/admin/pgn/<int:pgn_id>', methods=['DELETE'])
@require_admin
def delete_pgn(pgn_id):
    """管理员删除PGN（会删除所有用户的相关进度）"""
    try:
        with db_lock:
            conn = sqlite3.connect(DATABASE_PATH)
            cursor = conn.cursor()
            
            # 获取PGN信息
            cursor.execute('SELECT filename FROM pgn_games WHERE id = ?', (pgn_id,))
            pgn_info = cursor.fetchone()
            
            if not pgn_info:
                return jsonify({'error': 'PGN文件不存在'}), 404
            
            # 删除所有用户的进度记录
            cursor.execute('DELETE FROM user_progress WHERE pgn_game_id = ?', (pgn_id,))
            progress_deleted = cursor.rowcount
            
            # 删除所有用户的学习日志
            cursor.execute('DELETE FROM user_study_logs WHERE pgn_game_id = ?', (pgn_id,))
            logs_deleted = cursor.rowcount
            
            # 删除PGN文件记录
            cursor.execute('DELETE FROM pgn_games WHERE id = ?', (pgn_id,))
            
            conn.commit()
            conn.close()
        
        return jsonify({
            'success': True,
            'message': f'已删除PGN文件 "{pgn_info[0]}"，清理进度记录 {progress_deleted} 条，学习日志 {logs_deleted} 条'
        })
        
    except Exception as e:
        return jsonify({'error': f'删除PGN失败: {str(e)}'}), 500

@app.route('/api/admin/pgn/<int:pgn_id>/users', methods=['GET'])
@require_admin
def get_pgn_user_progress(pgn_id):
    """管理员查看指定PGN的所有用户进度"""
    try:
        with db_lock:
            conn = sqlite3.connect(DATABASE_PATH)
            cursor = conn.cursor()
            
            # 获取PGN信息
            cursor.execute('SELECT filename, total_branches FROM pgn_games WHERE id = ?', (pgn_id,))
            pgn_info = cursor.fetchone()
            
            if not pgn_info:
                return jsonify({'error': 'PGN文件不存在'}), 404
            
            # 获取所有用户在该PGN上的进度
            cursor.execute('''
                SELECT 
                    u.id,
                    u.username,
                    u.email,
                    COUNT(up.id) as practiced_branches,
                    SUM(CASE WHEN up.is_completed = 1 THEN 1 ELSE 0 END) as completed_branches,
                    SUM(CASE WHEN up.is_completed = 1 AND (up.correct_count * 1.0 / up.total_attempts) = 1.0 THEN 1 ELSE 0 END) as mastered_branches,
                    SUM(up.correct_count) as total_correct,
                    SUM(up.total_attempts) as total_attempts,
                    MAX(up.last_attempt_at) as last_practice_time,
                    u.created_at
                FROM users u
                LEFT JOIN user_progress up ON u.id = up.user_id AND up.pgn_game_id = ?
                WHERE EXISTS (
                    SELECT 1 FROM user_progress 
                    WHERE user_id = u.id AND pgn_game_id = ?
                )
                GROUP BY u.id, u.username, u.email, u.created_at
                ORDER BY last_practice_time DESC
            ''', (pgn_id, pgn_id))
            
            user_progress = cursor.fetchall()
            conn.close()
        
        filename, total_branches = pgn_info
        
        result = []
        for row in user_progress:
            user_id, username, email, practiced_branches, completed_branches, mastered_branches, total_correct, total_attempts, last_practice_time, created_at = row
            
            completion_rate = (completed_branches / total_branches * 100) if total_branches > 0 else 0
            mastery_rate = (mastered_branches / total_branches * 100) if total_branches > 0 else 0
            accuracy_rate = (total_correct / total_attempts * 100) if total_attempts > 0 else 0
            
            # 确定状态
            if mastery_rate >= 80:
                status = "已掌握"
                status_class = "completed"
            elif completion_rate >= 50:
                status = "学习中"
                status_class = "learning"
            elif completion_rate > 0:
                status = "初学"
                status_class = "beginner"
            else:
                status = "未开始"
                status_class = "not-started"
            
            result.append({
                'user_id': user_id,
                'username': username,
                'email': email or '',
                'total_branches': total_branches,
                'practiced_branches': practiced_branches or 0,
                'completed_branches': completed_branches or 0,
                'mastered_branches': mastered_branches or 0,
                'completion_rate': round(completion_rate, 1),
                'mastery_rate': round(mastery_rate, 1),
                'total_correct': total_correct or 0,
                'total_attempts': total_attempts or 0,
                'accuracy_rate': round(accuracy_rate, 1),
                'last_practice_time': last_practice_time,
                'created_at': created_at,
                'status': status,
                'status_class': status_class
            })
        
        return jsonify({
            'success': True,
            'pgn_filename': filename,
            'pgn_id': pgn_id,
            'total_branches': total_branches,
            'user_progress': result
        })
        
    except Exception as e:
        return jsonify({'error': f'获取用户进度失败: {str(e)}'}), 500

@app.route('/api/admin/pgn/<int:pgn_id>/users/<int:user_id>/reset', methods=['POST'])
@require_admin
def admin_reset_user_progress(pgn_id, user_id):
    """管理员彻底重置指定用户在指定PGN上的所有进度"""
    try:
        with db_lock:
            conn = sqlite3.connect(DATABASE_PATH)
            cursor = conn.cursor()
            
            # 验证PGN和用户是否存在
            cursor.execute('SELECT filename FROM pgn_games WHERE id = ?', (pgn_id,))
            pgn_info = cursor.fetchone()
            
            cursor.execute('SELECT username FROM users WHERE id = ?', (user_id,))
            user_info = cursor.fetchone()
            
            if not pgn_info:
                return jsonify({'error': 'PGN文件不存在'}), 404
            
            if not user_info:
                return jsonify({'error': '用户不存在'}), 404
            
            # 删除该用户在该PGN上的所有进度记录
            cursor.execute('''
                DELETE FROM user_progress 
                WHERE user_id = ? AND pgn_game_id = ?
            ''', (user_id, pgn_id))
            
            progress_deleted = cursor.rowcount
            
            # 删除该用户在该PGN上的所有学习日志
            cursor.execute('''
                DELETE FROM user_study_logs 
                WHERE user_id = ? AND pgn_game_id = ?
            ''', (user_id, pgn_id))
            
            logs_deleted = cursor.rowcount
            
            conn.commit()
            conn.close()
        
        return jsonify({
            'success': True,
            'message': f'已彻底重置用户 "{user_info[0]}" 在PGN "{pgn_info[0]}" 上的所有进度，清理进度记录 {progress_deleted} 条，学习日志 {logs_deleted} 条'
        })
        
    except Exception as e:
        return jsonify({'error': f'重置用户进度失败: {str(e)}'}), 500

@app.route('/api/admin/pgn-list', methods=['GET'])
@require_admin
def get_admin_pgn_list():
    """管理员获取所有PGN列表"""
    try:
        with db_lock:
            conn = sqlite3.connect(DATABASE_PATH)
            cursor = conn.cursor()
            
            cursor.execute('''
                SELECT 
                    pg.id,
                    pg.filename,
                    pg.upload_time,
                    pg.file_size,
                    pg.total_branches,
                    pg.total_games,
                    u.username as uploaded_by_username,
                    COUNT(DISTINCT up.user_id) as users_count,
                    SUM(up.total_attempts) as total_attempts
                FROM pgn_games pg
                LEFT JOIN users u ON pg.uploaded_by = u.id
                LEFT JOIN user_progress up ON pg.id = up.pgn_game_id
                GROUP BY pg.id, pg.filename, pg.upload_time, pg.file_size, pg.total_branches, pg.total_games, u.username
                ORDER BY pg.upload_time DESC
            ''')
            
            rows = cursor.fetchall()
            conn.close()
        
        result = []
        for row in rows:
            result.append({
                'id': row[0],
                'filename': row[1],
                'upload_time': row[2],
                'file_size': row[3],
                'total_branches': row[4],
                'total_games': row[5],
                'uploaded_by': row[6] or '未知',
                'users_count': row[7] or 0,
                'total_attempts': row[8] or 0
            })
        
        return jsonify({'success': True, 'pgn_list': result})
        
    except Exception as e:
        return jsonify({'error': f'获取PGN列表失败: {str(e)}'}), 500

def save_pgn_to_db(filename: str, original_content: str, parsed_data: dict, file_size: int):
    """保存PGN数据到数据库"""
    with db_lock:
        conn = sqlite3.connect(DATABASE_PATH)
        cursor = conn.cursor()
        
        # 获取上传用户ID
        uploaded_by = session.get('user_id')
        
        cursor.execute('''
            INSERT INTO pgn_games (filename, original_content, parsed_data, file_size, total_branches, total_games, uploaded_by)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        ''', (
            filename,
            original_content,
            json.dumps(parsed_data, ensure_ascii=False),
            file_size,
            parsed_data.get('total_branches', 0),
            len(parsed_data.get('games', [])),
            uploaded_by
        ))
        
        game_id = cursor.lastrowid
        conn.commit()
        conn.close()
        return game_id

def get_latest_pgn():
    """获取最新的PGN数据"""
    with db_lock:
        conn = sqlite3.connect(DATABASE_PATH)
        cursor = conn.cursor()
        
        cursor.execute('''
            SELECT id, filename, parsed_data, upload_time, file_size, total_branches, total_games
            FROM pgn_games 
            ORDER BY upload_time DESC 
            LIMIT 1
        ''')
        
        row = cursor.fetchone()
        conn.close()
        
        if row:
            return {
                'id': row[0],
                'filename': row[1],
                'parsed_data': json.loads(row[2]),
                'upload_time': row[3],
                'file_size': row[4],
                'total_branches': row[5],
                'total_games': row[6]
            }
        return None

def get_pgn_list(limit: int = 10):
    """获取PGN历史列表"""
    with db_lock:
        conn = sqlite3.connect(DATABASE_PATH)
        cursor = conn.cursor()
        
        cursor.execute('''
            SELECT id, filename, upload_time, file_size, total_branches, total_games
            FROM pgn_games 
            ORDER BY upload_time DESC 
            LIMIT ?
        ''', (limit,))
        
        rows = cursor.fetchall()
        conn.close()
        
        return [{
            'id': row[0],
            'filename': row[1],
            'upload_time': row[2],
            'file_size': row[3],
            'total_branches': row[4],
            'total_games': row[5]
        } for row in rows]

# 初始化数据库
init_database()

class PGNNode:
    """表示PGN棋谱树中的一个节点"""
    def __init__(self, move: str = None, fen: str = None, move_number: int = 0, is_white: bool = True):
        self.move = move  # 移动记录（SAN格式）
        self.fen = fen    # 该位置的FEN字符串
        self.move_number = move_number  # 回合数
        self.is_white = is_white  # 是否是白方移动
        self.children = []  # 子节点列表
        self.parent = None  # 父节点
        self.id = None  # 节点ID

    def add_child(self, child):
        """添加子节点"""
        child.parent = self
        self.children.append(child)
        return child

    def to_dict(self) -> Dict[str, Any]:
        """转换为字典格式用于JSON序列化"""
        return {
            'id': self.id,
            'move': self.move,
            'fen': self.fen,
            'move_number': self.move_number,
            'is_white': self.is_white,
            'children': [child.to_dict() for child in self.children]
        }

class PGNParser:
    """PGN棋谱解析器"""
    
    def __init__(self):
        self.root_node = None
        self.node_counter = 0
    
    def parse_pgn_content(self, pgn_content: str) -> Dict[str, Any]:
        """解析PGN内容并返回树状结构"""
        try:
            # 创建根节点（初始位置）
            self.root_node = PGNNode(
                move=None,
                fen=chess.STARTING_FEN,
                move_number=0,
                is_white=True
            )
            self.root_node.id = self._get_next_id()
            
            # 预处理PGN内容，检查基本格式
            if not pgn_content.strip():
                return {'error': '文件内容为空'}
            
            # 解析PGN
            pgn_io = io.StringIO(pgn_content)
            game = chess.pgn.read_game(pgn_io)
            
            if game is None:
                return {
                    'error': '无法解析PGN格式',
                    'details': '文件内容不符合标准PGN格式。PGN文件应该包含游戏信息标签（如[Event]、[Date]等）和移动记录。'
                }
            
            # 检查是否有移动记录
            if not game.variations:
                return {
                    'error': '没有找到移动记录',
                    'details': 'PGN文件中没有包含任何象棋移动记录。'
                }
            
            # 使用新的解析方法
            board = chess.Board()
            self._parse_node_recursive(game, self.root_node, board)
            
            # 提取所有分支路径
            branches = self._extract_branches()
            
            return {
                'success': True,
                'tree': self.root_node.to_dict(),
                'branches': branches,
                'total_branches': len(branches)
            }
            
        except chess.InvalidMoveError as e:
            return {
                'error': '无效的象棋移动',
                'details': f'PGN文件中包含无效的移动记录: {str(e)}'
            }
        except chess.IllegalMoveError as e:  
            return {
                'error': '非法的象棋移动',
                'details': f'PGN文件中包含非法的移动记录: {str(e)}'
            }
        except Exception as e:
            error_msg = str(e).lower()
            if 'invalid' in error_msg or 'illegal' in error_msg:
                return {
                    'error': '移动记录有误',
                    'details': f'PGN文件中的移动记录不正确: {str(e)}'
                }
            elif 'parse' in error_msg or 'format' in error_msg:
                return {
                    'error': '格式解析错误',
                    'details': f'PGN文件格式有问题: {str(e)}'
                }
            else:
                return {
                    'error': '解析过程中发生错误',
                    'details': str(e)
                }
    
    def _get_next_id(self) -> str:
        """生成下一个节点ID"""
        self.node_counter += 1
        return f"node_{self.node_counter}"
    
    def _parse_node_recursive(self, pgn_node: chess.pgn.GameNode, tree_node: PGNNode, board: chess.Board):
        """递归解析PGN节点"""
        # 处理主线
        current_pgn = pgn_node
        current_tree = tree_node
        
        while current_pgn.variations:
            # 获取主变体（第一个变体）
            main_variation = current_pgn.variations[0]
            
            if main_variation.move is not None:
                try:
                    # 获取SAN格式
                    san_move = board.san(main_variation.move)
                    # 执行移动
                    board.push(main_variation.move)
                    
                    # 创建树节点
                    move_number = (board.ply() + 1) // 2
                    is_white = board.ply() % 2 == 1
                    
                    new_tree_node = PGNNode(
                        move=san_move,
                        fen=board.fen(),
                        move_number=move_number,
                        is_white=is_white
                    )
                    new_tree_node.id = self._get_next_id()
                    current_tree.add_child(new_tree_node)
                    
                    # 处理其他变体（从第二个开始）
                    for i in range(1, len(current_pgn.variations)):
                        variation = current_pgn.variations[i]
                        if variation.move is not None:
                            # 对于变体，使用执行移动前的棋盘状态
                            board.pop()  # 撤销主变体移动
                            var_san = board.san(variation.move)
                            board.push(variation.move)  # 执行变体移动
                            
                            # 创建变体节点
                            var_move_number = (board.ply() + 1) // 2
                            var_is_white = board.ply() % 2 == 1
                            
                            var_tree_node = PGNNode(
                                move=var_san,
                                fen=board.fen(),
                                move_number=var_move_number,
                                is_white=var_is_white
                            )
                            var_tree_node.id = self._get_next_id()
                            current_tree.add_child(var_tree_node)
                            
                            # 递归处理变体的后续
                            if variation.variations:
                                self._parse_node_recursive(variation, var_tree_node, board.copy())
                            
                            board.pop()  # 撤销变体移动
                            board.push(main_variation.move)  # 重新执行主变体移动
                    
                    # 继续主线
                    current_pgn = main_variation
                    current_tree = new_tree_node
                    
                except Exception as e:
                    raise Exception(f"解析移动 {main_variation.move} 失败: {str(e)}")
            else:
                break
    
    def _extract_branches(self) -> List[Dict[str, Any]]:
        """提取所有分支路径"""
        branches = []
        self._extract_paths(self.root_node, [], branches)
        return branches
    
    def _extract_paths(self, node: PGNNode, current_path: List[str], branches: List[Dict[str, Any]]):
        """递归提取路径"""
        # 如果当前节点有移动，添加到路径中
        if node.move:
            current_path.append(node.move)
        
        # 如果是叶子节点且路径不为空，添加分支
        if not node.children and current_path:
            branches.append({
                'id': f'branch_{len(branches) + 1}',
                'moves': current_path.copy()
            })
        
        # 递归处理子节点
        for child in node.children:
            self._extract_paths(child, current_path.copy(), branches)

@app.route('/')
def index():
    """返回主页面"""
    # 获取项目根目录（backend的上级目录）
    current_dir = os.path.dirname(os.path.abspath(__file__))
    project_root = os.path.dirname(current_dir)
    return send_from_directory(project_root, 'index.html')

@app.route('/<path:filename>')
def static_files(filename):
    """提供静态文件（CSS、JS、图片等）"""
    # 获取项目根目录
    current_dir = os.path.dirname(os.path.abspath(__file__))
    project_root = os.path.dirname(current_dir)
    return send_from_directory(project_root, filename)

@app.route('/api/parse-pgn', methods=['POST'])
@require_login
def parse_pgn():
    """解析文件（支持任何格式，但主要用于PGN）"""
    try:
        if 'file' not in request.files:
            return jsonify({'error': '没有文件上传'}), 400
        
        file = request.files['file']
        if file.filename == '':
            return jsonify({'error': '没有选择文件'}), 400
        
        # 检查是否强制覆盖
        force_overwrite = request.form.get('force_overwrite', 'false').lower() == 'true'
        
        # 检查是否存在同名文件
        with db_lock:
            conn = sqlite3.connect(DATABASE_PATH)
            cursor = conn.cursor()
            cursor.execute('SELECT id, filename FROM pgn_games WHERE filename = ?', (file.filename,))
            existing_pgn = cursor.fetchone()
            conn.close()
        
        current_user = get_current_user()
        
        # 如果存在同名文件且不是强制覆盖，需要管理员确认
        if existing_pgn and not force_overwrite:
            if current_user and current_user['role'] == 'admin':
                return jsonify({
                    'conflict': True,
                    'message': f'已存在同名PGN文件 "{file.filename}"',
                    'existing_pgn_id': existing_pgn[0],
                    'question': '是否要覆盖原有文件并重置所有用户的进度？',
                    'warning': '⚠️ 覆盖操作将删除所有用户在该PGN上的学习进度，此操作不可撤销！'
                })
            else:
                return jsonify({
                    'error': '文件名冲突',
                    'message': f'已存在同名PGN文件 "{file.filename}"，请联系管理员处理或重命名文件'
                }), 409
        
        # 尝试读取文件内容，支持多种编码
        content = None
        file_info = {
            'filename': file.filename,
            'size': 0
        }
        
        try:
            # 首先尝试UTF-8编码
            raw_content = file.read()
            file_info['size'] = len(raw_content)
            content = raw_content.decode('utf-8')
        except UnicodeDecodeError:
            try:
                # 如果UTF-8失败，尝试GBK编码（中文文件常用）
                content = raw_content.decode('gbk')
            except UnicodeDecodeError:
                try:
                    # 最后尝试latin-1编码（通常不会失败）
                    content = raw_content.decode('latin-1')
                except UnicodeDecodeError:
                    return jsonify({
                        'error': '文件编码不支持',
                        'message': f'无法读取文件 "{file.filename}"，请确保文件是文本格式并使用UTF-8、GBK或其他常见编码'
                    }), 400
        
        # 检查文件是否为空
        if not content.strip():
            return jsonify({
                'error': '文件内容为空',
                'message': f'上传的文件 "{file.filename}" 没有内容'
            }), 400
        
        # 简单检查是否可能是PGN格式
        pgn_indicators = ['[Event', '[Site', '[Date', '[Round', '[White', '[Black', '[Result', '1.', '1...', 'e4', 'd4', 'Nf3']
        likely_pgn = any(indicator in content for indicator in pgn_indicators)
        
        # 解析PGN
        parser = PGNParser()
        result = parser.parse_pgn_content(content)
        
        if 'error' in result:
            # 根据文件内容提供更具体的错误信息
            error_details = result.get('details', result.get('error', '未知错误'))
            
            if not likely_pgn:
                return jsonify({
                    'error': '文件格式不正确',
                    'message': f'上传的文件 "{file.filename}" 似乎不是PGN格式。PGN文件通常包含象棋游戏记录，以方括号标签（如[Event]、[White]、[Black]）开始，然后是移动记录。',
                    'details': error_details,
                    'suggestion': '请上传一个有效的PGN文件，或检查文件内容是否包含正确的象棋记录格式。',
                    'file_info': file_info
                }), 400
            else:
                return jsonify({
                    'error': 'PGN解析失败',
                    'message': f'文件 "{file.filename}" 看起来像PGN格式，但解析时出现错误。',
                    'details': error_details,
                    'suggestion': '请检查PGN文件的格式是否正确，确保移动记录符合标准PGN格式。',
                    'file_info': file_info
                }), 400
            
        # 生成HTML格式的树状图
        tree_html = generate_tree_html(result['tree'])
        result['tree_html'] = tree_html
        result['file_info'] = file_info
        
        # 如果是覆盖操作，先删除原有数据
        if existing_pgn and force_overwrite:
            with db_lock:
                conn = sqlite3.connect(DATABASE_PATH)
                cursor = conn.cursor()
                
                # 删除所有用户的进度记录
                cursor.execute('DELETE FROM user_progress WHERE pgn_game_id = ?', (existing_pgn[0],))
                
                # 删除所有用户的学习日志
                cursor.execute('DELETE FROM user_study_logs WHERE pgn_game_id = ?', (existing_pgn[0],))
                
                # 删除原有PGN记录
                cursor.execute('DELETE FROM pgn_games WHERE id = ?', (existing_pgn[0],))
                
                conn.commit()
                conn.close()
                
                print(f"覆盖操作：已删除原有PGN '{file.filename}' (ID: {existing_pgn[0]}) 及相关数据")
        
        # 保存到数据库
        try:
            game_id = save_pgn_to_db(
                filename=file.filename,
                original_content=content,
                parsed_data=result,
                file_size=file_info['size']
            )
            result['game_id'] = game_id
            # 添加metadata信息
            result['metadata'] = {
                'id': game_id,
                'filename': file.filename,
                'file_size': file_info['size']
            }
            
            if existing_pgn and force_overwrite:
                result['overwritten'] = True
                result['message'] = f"成功覆盖PGN文件 {file.filename}，所有用户的学习进度已重置"
                print(f"成功覆盖保存PGN到数据库，新ID: {game_id}, 文件名: {file.filename}")
            else:
                print(f"成功保存PGN到数据库，ID: {game_id}, 文件名: {file.filename}")
                
        except Exception as e:
            print(f"保存到数据库失败: {str(e)}")
            # 不影响返回结果，只记录错误
        
        return jsonify(result)
        
    except Exception as e:
        return jsonify({
            'error': '服务器错误',
            'message': f'处理文件时发生错误: {str(e)}',
            'suggestion': '请检查文件是否损坏，或联系管理员'
        }), 500

@app.route('/api/test-tree', methods=['GET'])
def test_tree():
    """测试接口，展示树状结构"""
    try:
        # 读取测试文件
        current_dir = os.path.dirname(os.path.abspath(__file__))
        test_file_path = os.path.join(current_dir, '..', 'white_black_2025.pgn')
        
        if not os.path.exists(test_file_path):
            return jsonify({'error': '测试文件不存在'}), 404
        
        with open(test_file_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # 解析PGN
        parser = PGNParser()
        result = parser.parse_pgn_content(content)
        
        if 'error' in result:
            return jsonify(result), 400
        
        # 生成HTML格式的树状图
        tree_html = generate_tree_html(result['tree'])
        
        return jsonify({
            'success': True,
            'tree': result['tree'],
            'tree_html': tree_html,
            'branches': result['branches'],
            'total_branches': result['total_branches']
        })
        
    except Exception as e:
        return jsonify({'error': f'测试错误: {str(e)}'}), 500

def generate_tree_html(tree_node: Dict[str, Any], level: int = 0) -> str:
    """生成树状结构的HTML"""
    html = '<div class="tree-container horizontal">'
    html += _generate_node_html(tree_node, level)
    html += '</div>'
    return html

def _generate_node_html(node: Dict[str, Any], level: int) -> str:
    """递归生成节点HTML"""
    indent = '  ' * level
    move_text = node['move'] if node['move'] else '起始位置'
    
    # 节点样式
    node_class = 'white-move' if node['is_white'] else 'black-move'
    if node['move'] is None:
        node_class = 'root-node'
    
    has_children = bool(node['children'])
    expand_button = ''
    if has_children:
        expand_button = '<span class="expand-button expanded">-</span>'
    
    html = f'{indent}<div class="tree-node {node_class}" data-level="{level}">\n'
    html += f'{indent}  <div class="node-wrapper">\n'
    html += f'{indent}    <div class="node-content">\n'
    html += f'{indent}      <span class="move-number">{node["move_number"]}.</span>\n'
    html += f'{indent}      <span class="move-text">{move_text}</span>\n'
    html += f'{indent}      {expand_button}\n'
    html += f'{indent}    </div>\n'
    html += f'{indent}  </div>\n'
    
    # 处理子节点
    if has_children:
        html += f'{indent}  <div class="children-container expanded">\n'
        for child in node['children']:
            html += _generate_node_html(child, level + 1)
        html += f'{indent}  </div>\n'
    
    html += f'{indent}</div>\n'
    return html

@app.route('/api/latest-pgn', methods=['GET'])
@require_login
def get_latest_pgn_api():
    """获取最新上传的PGN数据"""
    try:
        latest_pgn = get_latest_pgn()
        
        if latest_pgn is None:
            return jsonify({
                'success': False,
                'message': '没有找到任何PGN数据'
            }), 404
        
        # 返回解析后的数据，格式与parse-pgn API一致
        response_data = latest_pgn['parsed_data'].copy()
        response_data['metadata'] = {
            'id': latest_pgn['id'],
            'filename': latest_pgn['filename'],
            'upload_time': latest_pgn['upload_time'],
            'file_size': latest_pgn['file_size'],
            'total_branches': latest_pgn['total_branches'],
            'total_games': latest_pgn['total_games']
        }
        
        print(f"返回最新PGN数据: {latest_pgn['filename']}, 分支数: {latest_pgn['total_branches']}")
        return jsonify(response_data)
        
    except Exception as e:
        print(f"获取最新PGN数据失败: {str(e)}")
        return jsonify({
            'error': '获取最新PGN数据失败',
            'message': str(e)
        }), 500

@app.route('/api/pgn-list', methods=['GET'])
@require_login
def get_pgn_list_api():
    """获取PGN历史列表"""
    try:
        limit = request.args.get('limit', 10, type=int)
        pgn_list = get_pgn_list(limit)
        
        return jsonify({
            'success': True,
            'data': pgn_list,
            'count': len(pgn_list)
        })
        
    except Exception as e:
        return jsonify({
            'error': '获取PGN列表失败',
            'message': str(e)
        }), 500

@app.route('/api/pgn/<int:pgn_id>', methods=['GET'])
@require_login
def get_pgn_by_id(pgn_id):
    """根据ID获取PGN数据"""
    try:
        with db_lock:
            conn = sqlite3.connect(DATABASE_PATH)
            cursor = conn.cursor()
            
            cursor.execute('''
                SELECT id, filename, original_content, parsed_data, upload_time, file_size
                FROM pgn_games 
                WHERE id = ?
            ''', (pgn_id,))
            
            row = cursor.fetchone()
            conn.close()
            
            if not row:
                return jsonify({
                    'success': False,
                    'error': '未找到指定的PGN文件'
                }), 404
            
            # 解析存储的数据
            parsed_data = json.loads(row[3]) if row[3] else {}
            
            # 构建返回数据，格式与 latest-pgn API 类似
            response_data = parsed_data.copy()
            response_data['metadata'] = {
                'id': row[0],
                'filename': row[1],
                'upload_time': row[4],
                'file_size': row[5],
                'total_branches': len(parsed_data.get('branches', [])),
                'total_games': parsed_data.get('total_games', 0)
            }
            
            return jsonify(response_data)
            
    except Exception as e:
        print(f"获取PGN数据失败: {str(e)}")
        return jsonify({
            'success': False,
            'error': f'获取PGN数据失败: {str(e)}'
        }), 500

@app.route('/api/health', methods=['GET'])
def health_check():
    """健康检查接口"""
    return jsonify({'status': 'healthy', 'message': '后端服务正常运行'})

@app.errorhandler(404)
def not_found(error):
    """404错误处理"""
    return jsonify({
        'error': '页面未找到',
        'message': '请检查URL是否正确',
        'available_endpoints': [
            'GET / - 欢迎页面',
            'GET /api/health - 健康检查',
            'POST /api/parse-pgn - 解析PGN文件',
            'GET /api/test-tree - 测试树状结构'
        ]
    }), 404

@app.errorhandler(500)
def internal_error(error):
    """500错误处理"""
    return jsonify({
        'error': '服务器内部错误',
        'message': '请联系管理员或查看服务器日志'
    }), 500

if __name__ == '__main__':
    print("🚀 启动国际象棋开局记忆系统后端服务...")
    print("📋 可用的API端点:")
    print("   GET  /              - 主页面 (index.html)")
    print("   GET  /api/health    - 健康检查")
    print("")
    print("🔐 用户认证API:")
    print("   POST /api/auth/login    - 用户登录")
    print("   POST /api/auth/logout   - 用户登出")
    print("   POST /api/auth/register - 用户注册")
    print("   GET  /api/auth/me       - 获取当前用户信息")
    print("")
    print("👥 管理员API (需要管理员权限):")
    print("   GET    /api/admin/users        - 获取用户列表")
    print("   POST   /api/admin/users        - 创建新用户")
    print("   PUT    /api/admin/users/<id>   - 更新用户信息")
    print("   DELETE /api/admin/users/<id>   - 删除用户")
    print("")
    print("📚 学习进度API (需要登录):")
    print("   GET  /api/progress/my     - 获取我的学习进度")
    print("   POST /api/progress/update - 更新学习进度")
    print("   POST /api/progress/reset  - 重置学习进度（保留已完成分支）")
    print("   GET  /api/progress/stats  - 获取学习统计")
    print("")
    print("📄 PGN文件API (需要登录):")
    print("   POST /api/parse-pgn - 解析PGN文件并保存到数据库")
    print("   GET  /api/latest-pgn - 获取最新上传的PGN数据")
    print("   GET  /api/pgn-list  - 获取PGN历史列表")
    print("   GET  /api/test-tree - 测试树状结构")
    print("")
    print("🌐 服务地址: http://localhost:5000")
    print("📁 前端页面: 直接访问 http://localhost:5000 即可使用")
    print("📁 测试页面: 访问 http://localhost:5000/tree_test.html")
    print("👤 默认管理员账号: admin / admin123")
    print("💡 文件上传: 支持任意格式文件上传，系统会智能识别PGN格式")
    print("📈 进度跟踪: 系统会自动记录每个用户的学习进度和统计信息")
    print("=" * 60)
    
    app.run(debug=True, host='0.0.0.0', port=5000, threaded=True) 