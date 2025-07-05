#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
测试PGN权限授予功能

该脚本用于验证管理员可以给普通用户（包括其他管理员）授予PGN访问权限，
并验证权限授予后，用户可以在学习进度页面看到可访问的PGN文件。
"""

import sqlite3
import sys
import os
import json

# 添加父目录到路径以导入app模块
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

DATABASE_PATH = 'chess_pgn.db'

def test_permission_grant():
    """测试PGN权限授予功能"""
    
    if not os.path.exists(DATABASE_PATH):
        print("❌ 数据库文件不存在，请先启动应用")
        return
    
    conn = sqlite3.connect(DATABASE_PATH)
    cursor = conn.cursor()
    
    print("🔍 测试PGN权限授予功能...")
    print("=" * 60)
    
    # 1. 检查现有用户
    cursor.execute('SELECT id, username, role FROM users ORDER BY id')
    users = cursor.fetchall()
    
    print("👥 系统中的用户:")
    for user_id, username, role in users:
        print(f"   - ID: {user_id}, 用户名: {username}, 角色: {role}")
    
    # 2. 检查现有PGN文件
    cursor.execute('SELECT id, filename, uploaded_by FROM pgn_games ORDER BY id')
    pgns = cursor.fetchall()
    
    print(f"\n📚 系统中的PGN文件 ({len(pgns)}个):")
    for pgn_id, filename, uploaded_by in pgns:
        print(f"   - ID: {pgn_id}, 文件名: {filename}, 上传者ID: {uploaded_by}")
    
    if not pgns:
        print("❌ 没有PGN文件，请先上传一些PGN文件")
        conn.close()
        return
    
    # 3. 检查现有权限
    cursor.execute('''
        SELECT p.pgn_id, p.user_id, u.username, pg.filename, p.granted_at
        FROM pgn_permissions p
        JOIN users u ON p.user_id = u.id
        JOIN pgn_games pg ON p.pgn_id = pg.id
        ORDER BY p.pgn_id, p.user_id
    ''')
    permissions = cursor.fetchall()
    
    print(f"\n🔐 现有权限记录 ({len(permissions)}条):")
    if permissions:
        for pgn_id, user_id, username, filename, granted_at in permissions:
            print(f"   - PGN: {filename} (ID: {pgn_id}) → 用户: {username} (ID: {user_id}), 授予时间: {granted_at}")
    else:
        print("   暂无权限记录")
    
    # 4. 测试管理员用户是否被排除
    cursor.execute('''
        SELECT id, username, email, role
        FROM users 
        WHERE is_active = 1
        ORDER BY role DESC, username
    ''')
    
    all_users = cursor.fetchall()
    print(f"\n👨‍💼 所有活跃用户 ({len(all_users)}个) - 按修复后的查询:")
    for user_id, username, email, role in all_users:
        print(f"   - ID: {user_id}, 用户名: {username}, 邮箱: {email or '无'}, 角色: {role}")
    
    # 5. 模拟权限授予查询（管理员操作）
    if pgns and len(users) > 1:
        test_pgn_id = pgns[0][0]  # 第一个PGN
        test_pgn_filename = pgns[0][1]
        
        print(f"\n🧪 模拟权限管理查询 (PGN: {test_pgn_filename}):")
        
        # 获取已授权用户
        cursor.execute('''
            SELECT u.id, u.username, u.email, p.granted_at
            FROM pgn_permissions p
            JOIN users u ON p.user_id = u.id
            WHERE p.pgn_id = ?
            ORDER BY p.granted_at DESC
        ''', (test_pgn_id,))
        
        authorized_users = cursor.fetchall()
        print(f"   📋 已授权用户 ({len(authorized_users)}个):")
        authorized_user_ids = set()
        for user_id, username, email, granted_at in authorized_users:
            authorized_user_ids.add(user_id)
            print(f"      - {username} (ID: {user_id}), 邮箱: {email or '无'}, 授权时间: {granted_at}")
        
        # 获取可授权用户（包括管理员）
        print(f"   📝 可授权用户列表:")
        for user_id, username, email, role in all_users:
            has_access = user_id in authorized_user_ids
            status = "已授权" if has_access else "未授权"
            role_display = "管理员" if role == 'admin' else "普通用户"
            print(f"      - {username} (ID: {user_id}) [{role_display}] - {status}")
    
    # 6. 测试普通用户的PGN列表查询
    normal_users = [u for u in users if u[2] != 'admin']
    if normal_users:
        test_user = normal_users[0]
        user_id, username, role = test_user
        
        print(f"\n🔍 测试用户 '{username}' (ID: {user_id}) 的PGN访问权限:")
        
        # 模拟 /api/pgn-list API 的查询
        cursor.execute('''
            SELECT DISTINCT g.id, g.filename, g.upload_time, g.file_size, 
                   g.total_branches, g.total_games
            FROM pgn_games g
            JOIN pgn_permissions p ON g.id = p.pgn_id
            WHERE p.user_id = ?
            ORDER BY g.upload_time DESC 
        ''', (user_id,))
        
        accessible_pgns = cursor.fetchall()
        print(f"   📚 可访问的PGN文件 ({len(accessible_pgns)}个):")
        if accessible_pgns:
            for pgn_id, filename, upload_time, file_size, total_branches, total_games in accessible_pgns:
                print(f"      - {filename} (ID: {pgn_id}), 分支数: {total_branches}, 游戏数: {total_games}")
        else:
            print("      无可访问的PGN文件")
    
    # 7. 测试管理员用户的PGN列表查询
    admin_users = [u for u in users if u[2] == 'admin']
    if admin_users:
        test_admin = admin_users[0]
        user_id, username, role = test_admin
        
        print(f"\n👨‍💼 测试管理员 '{username}' (ID: {user_id}) 的PGN访问权限:")
        
        # 管理员可以看到所有PGN
        cursor.execute('''
            SELECT id, filename, upload_time, file_size, total_branches, total_games
            FROM pgn_games 
            ORDER BY upload_time DESC 
        ''')
        
        all_pgns = cursor.fetchall()
        print(f"   📚 可访问的PGN文件 ({len(all_pgns)}个) - 管理员可看到所有:")
        for pgn_id, filename, upload_time, file_size, total_branches, total_games in all_pgns:
            print(f"      - {filename} (ID: {pgn_id}), 分支数: {total_branches}, 游戏数: {total_games}")
    
    conn.close()
    print("\n" + "=" * 60)
    print("🔍 权限测试完成！")
    print("\n💡 测试说明:")
    print("   1. 现在管理员用户也会显示在可授权列表中")
    print("   2. 用户被授予权限后，可以通过 /api/pgn-list API 看到可访问的PGN")
    print("   3. 学习进度页面会调用该API来显示可用的PGN列表")
    print("   4. 如果没有学习记录，页面会自动显示可用PGN供用户开始学习")

if __name__ == "__main__":
    test_permission_grant() 