from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import chess
import chess.pgn
import io
import re
from typing import Dict, List, Any, Optional
import os
import sqlite3
import json
from datetime import datetime
import threading

app = Flask(__name__)
CORS(app)  # 允许跨域请求

# 数据库配置
DATABASE_PATH = 'chess_pgn.db'
db_lock = threading.Lock()

def init_database():
    """初始化数据库"""
    with db_lock:
        conn = sqlite3.connect(DATABASE_PATH)
        cursor = conn.cursor()
        
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
                total_games INTEGER
            )
        ''')
        
        conn.commit()
        conn.close()

def save_pgn_to_db(filename: str, original_content: str, parsed_data: dict, file_size: int):
    """保存PGN数据到数据库"""
    with db_lock:
        conn = sqlite3.connect(DATABASE_PATH)
        cursor = conn.cursor()
        
        cursor.execute('''
            INSERT INTO pgn_games (filename, original_content, parsed_data, file_size, total_branches, total_games)
            VALUES (?, ?, ?, ?, ?, ?)
        ''', (
            filename,
            original_content,
            json.dumps(parsed_data, ensure_ascii=False),
            file_size,
            parsed_data.get('total_branches', 0),
            len(parsed_data.get('games', []))
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
def parse_pgn():
    """解析文件（支持任何格式，但主要用于PGN）"""
    try:
        if 'file' not in request.files:
            return jsonify({'error': '没有文件上传'}), 400
        
        file = request.files['file']
        if file.filename == '':
            return jsonify({'error': '没有选择文件'}), 400
        
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
        
        # 保存到数据库
        try:
            game_id = save_pgn_to_db(
                filename=file.filename,
                original_content=content,
                parsed_data=result,
                file_size=file_info['size']
            )
            result['game_id'] = game_id
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
    print("   POST /api/parse-pgn - 解析PGN文件并保存到数据库")
    print("   GET  /api/latest-pgn - 获取最新上传的PGN数据")
    print("   GET  /api/pgn-list  - 获取PGN历史列表")
    print("   GET  /api/test-tree - 测试树状结构")
    print("🌐 服务地址: http://localhost:5000")
    print("📁 前端页面: 直接访问 http://localhost:5000 即可使用")
    print("📁 测试页面: 访问 http://localhost:5000/tree_test.html")
    print("💡 文件上传: 支持任意格式文件上传，系统会智能识别PGN格式")
    print("=" * 50)
    
    app.run(debug=True, host='0.0.0.0', port=5000) 