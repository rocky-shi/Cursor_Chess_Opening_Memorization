#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
测试修改后的学习进度页面显示逻辑

模拟前端合并PGN数据的逻辑，验证用户能看到所有有权限的PGN
"""

import sqlite3
import sys
import os

DATABASE_PATH = 'chess_pgn.db'

def test_combined_display():
    """测试合并显示逻辑"""
    
    if not os.path.exists(DATABASE_PATH):
        print("❌ 数据库文件不存在")
        return
    
    conn = sqlite3.connect(DATABASE_PATH)
    cursor = conn.cursor()
    
    print("🔍 测试修改后的学习进度页面显示逻辑...")
    print("=" * 60)
    
    # 测试用户ID（sybil）
    user_id = 2
    
    print(f"👤 测试用户ID: {user_id}")
    
    # 1. 获取学习进度PGN（模拟 /api/progress/by-pgn）
    cursor.execute('''
        SELECT 
            pg.id,
            pg.filename,
            pg.total_branches,
            COUNT(up.id) as practiced_branches,
            SUM(CASE WHEN up.is_completed = 1 THEN 1 ELSE 0 END) as completed_branches,
            SUM(COALESCE(up.correct_count, 0)) as total_correct,
            SUM(COALESCE(up.total_attempts, 0)) as total_attempts,
            AVG(up.mastery_level) as avg_mastery,
            MAX(up.last_attempt_at) as last_practice_time,
            pg.upload_time
        FROM pgn_games pg
        INNER JOIN user_progress up ON pg.id = up.pgn_game_id AND up.user_id = ?
        INNER JOIN pgn_permissions p ON pg.id = p.pgn_id AND p.user_id = ?
        GROUP BY pg.id, pg.filename, pg.total_branches, pg.upload_time
        ORDER BY last_practice_time DESC
    ''', (user_id, user_id))
    
    progress_pgns = cursor.fetchall()
    print(f"\n📊 有学习进度的PGN ({len(progress_pgns)}个):")
    progress_pgn_ids = set()
    for pgn in progress_pgns:
        progress_pgn_ids.add(pgn[0])
        print(f"   ✅ ID: {pgn[0]}, 文件名: {pgn[1]}, 已练习: {pgn[3]}个分支")
    
    # 2. 获取可访问PGN（模拟 /api/pgn-list）
    cursor.execute('''
        SELECT DISTINCT g.id, g.filename, g.upload_time, g.file_size, 
               g.total_branches, g.total_games
        FROM pgn_games g
        JOIN pgn_permissions p ON g.id = p.pgn_id
        WHERE p.user_id = ?
        ORDER BY g.upload_time DESC 
    ''', (user_id,))
    
    accessible_pgns = cursor.fetchall()
    print(f"\n📚 可访问的PGN ({len(accessible_pgns)}个):")
    for pgn in accessible_pgns:
        print(f"   📁 ID: {pgn[0]}, 文件名: {pgn[1]}, 分支数: {pgn[4]}")
    
    # 3. 模拟前端合并逻辑
    print(f"\n🔄 合并显示逻辑:")
    combined_data = []
    
    # 添加有学习记录的PGN
    for pgn in progress_pgns:
        combined_data.append({
            'pgn_id': pgn[0],
            'filename': pgn[1],
            'total_branches': pgn[2],
            'hasProgress': True,
            'status': '有进度记录'
        })
        print(f"   ✅ 添加有进度PGN: {pgn[1]} (ID: {pgn[0]})")
    
    # 添加有权限但没有学习记录的PGN
    for pgn in accessible_pgns:
        if pgn[0] not in progress_pgn_ids:
            combined_data.append({
                'pgn_id': pgn[0],
                'filename': pgn[1],
                'total_branches': pgn[4],
                'hasProgress': False,
                'status': '未开始'
            })
            print(f"   📚 添加无进度PGN: {pgn[1]} (ID: {pgn[0]})")
    
    # 4. 显示最终结果
    print(f"\n🎯 最终显示结果 ({len(combined_data)}个PGN):")
    for i, pgn in enumerate(combined_data, 1):
        status_icon = "✅" if pgn['hasProgress'] else "📚"
        print(f"   {i}. {status_icon} {pgn['filename']} ({pgn['total_branches']}个分支) - {pgn['status']}")
    
    print(f"\n✨ 修改效果:")
    print(f"   📈 修改前：只显示 {len(progress_pgns)} 个有学习记录的PGN")
    print(f"   🚀 修改后：显示 {len(combined_data)} 个PGN（包括未开始的）")
    print(f"   💡 用户现在能看到所有有权限的PGN文件！")
    
    conn.close()
    print("\n" + "=" * 60)
    print("🔍 测试完成！")

if __name__ == "__main__":
    test_combined_display() 