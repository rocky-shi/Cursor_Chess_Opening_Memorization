from flask import Flask, request, jsonify
from flask_cors import CORS
import chess
import chess.pgn
import io
import re
from typing import Dict, List, Any, Optional
import os

app = Flask(__name__)
CORS(app)  # 允许跨域请求

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
            
            # 解析PGN
            pgn_io = io.StringIO(pgn_content)
            game = chess.pgn.read_game(pgn_io)
            
            if game is None:
                return {'error': '无法解析PGN文件'}
            
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
            
        except Exception as e:
            return {'error': f'解析错误: {str(e)}'}
    
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
def welcome():
    """欢迎页面"""
    return jsonify({
        'message': '欢迎使用国际象棋开局记忆系统后端API',
        'version': '1.0.0',
        'endpoints': {
            'health': 'GET /api/health - 健康检查',
            'parse_pgn': 'POST /api/parse-pgn - 解析PGN文件',
            'test_tree': 'GET /api/test-tree - 测试树状结构'
        },
        'frontend': {
            'main': '请访问 index.html 使用主要功能',
            'tree_test': '请访问 tree_test.html 测试树状结构'
        }
    })

@app.route('/api/parse-pgn', methods=['POST'])
def parse_pgn():
    """解析PGN文件"""
    try:
        if 'file' not in request.files:
            return jsonify({'error': '没有文件上传'}), 400
        
        file = request.files['file']
        if file.filename == '':
            return jsonify({'error': '没有选择文件'}), 400
        
        # 读取文件内容
        content = file.read().decode('utf-8')
        
        # 解析PGN
        parser = PGNParser()
        result = parser.parse_pgn_content(content)
        
        if 'error' in result:
            return jsonify(result), 400
            
        # 生成HTML格式的树状图
        tree_html = generate_tree_html(result['tree'])
        result['tree_html'] = tree_html
        
        return jsonify(result)
        
    except Exception as e:
        return jsonify({'error': f'服务器错误: {str(e)}'}), 500

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
    print("   GET  /              - 欢迎页面")
    print("   GET  /api/health    - 健康检查")
    print("   POST /api/parse-pgn - 解析PGN文件")
    print("   GET  /api/test-tree - 测试树状结构")
    print("🌐 服务地址: http://localhost:5000")
    print("📁 前端页面: 请访问 index.html 或 tree_test.html")
    print("=" * 50)
    
    app.run(debug=True, host='0.0.0.0', port=5000) 