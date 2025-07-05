#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
调试学习进度页面PGN显示问题

用于检查用户被授予权限后，为什么学习进度页面只显示部分PGN文件
"""

import sqlite3
import sys
import os

DATABASE_PATH = 'chess_pgn.db'

def debug_progress_display():
    """调试学习进度显示问题"""
    
    if not os.path.exists(DATABASE_PATH):
        print("❌ 数据库文件不存在")
        return
    
    conn = sqlite3.connect(DATABASE_PATH)
    cursor = conn.cursor()
    
    print("🔍 调试学习进度页面PGN显示问题...")
    print("=" * 60)
    
    # 测试用户ID（sybil）
    user_id = 2
    
    print(f"👤 测试用户ID: {user_id}")
    
    # 1. 检查用户权限（模拟 /api/pgn-list API）
    cursor.execute('''
        SELECT DISTINCT g.id, g.filename, g.upload_time, g.file_size, 
               g.total_branches, g.total_games
        FROM pgn_games g
        JOIN pgn_permissions p ON g.id = p.pgn_id
        WHERE p.user_id = ?
        ORDER BY g.upload_time DESC 
    ''', (user_id,))
    
    accessible_pgns = cursor.fetchall()
    print(f"\n📚 用户可访问的PGN文件 ({len(accessible_pgns)}个) - /api/pgn-list API:")
    for pgn in accessible_pgns:
        print(f"   - ID: {pgn[0]}, 文件名: {pgn[1]}, 分支数: {pgn[4]}, 游戏数: {pgn[5]}")
    
    # 2. 检查用户学习进度记录（模拟 /api/progress/by-pgn API）
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
    print(f"\n📊 用户有学习进度的PGN文件 ({len(progress_pgns)}个) - /api/progress/by-pgn API:")
    for pgn in progress_pgns:
        print(f"   - ID: {pgn[0]}, 文件名: {pgn[1]}, 已练习分支: {pgn[3]}, 最后练习: {pgn[8] or '从未'}")
    
    # 3. 分析问题
    print(f"\n🔍 问题分析:")
    if len(accessible_pgns) > len(progress_pgns):
        no_progress_pgns = []
        progress_pgn_ids = {pgn[0] for pgn in progress_pgns}
        
        for pgn in accessible_pgns:
            if pgn[0] not in progress_pgn_ids:
                no_progress_pgns.append(pgn)
        
        print(f"   ✅ 用户有权限但没有学习记录的PGN ({len(no_progress_pgns)}个):")
        for pgn in no_progress_pgns:
            print(f"      - ID: {pgn[0]}, 文件名: {pgn[1]}")
        
        print(f"\n💡 学习进度页面的逻辑:")
        print(f"   1. 首先调用 /api/progress/by-pgn 获取有学习记录的PGN")
        print(f"   2. 如果没有学习记录，会调用 /api/pgn-list 显示可用PGN")
        print(f"   3. 如果有部分学习记录，只会显示有记录的PGN")
        print(f"\n⚠️  问题所在:")
        print(f"   - 用户有{len(progress_pgns)}个PGN的学习记录")
        print(f"   - 但还有{len(no_progress_pgns)}个有权限但未练习的PGN")
        print(f"   - 学习进度页面只显示有记录的PGN，忽略了未练习的")
    else:
        print(f"   ✅ 用户可访问的PGN都有学习记录")
    
    # 4. 检查具体的用户进度记录
    print(f"\n📋 详细的用户进度记录:")
    cursor.execute('''
        SELECT pgn_game_id, branch_id, is_completed, correct_count, total_attempts, last_attempt_at
        FROM user_progress 
        WHERE user_id = ?
        ORDER BY pgn_game_id, branch_id
    ''', (user_id,))
    
    all_progress = cursor.fetchall()
    if all_progress:
        current_pgn = None
        for record in all_progress:
            pgn_id, branch_id, is_completed, correct_count, total_attempts, last_attempt = record
            if pgn_id != current_pgn:
                cursor.execute('SELECT filename FROM pgn_games WHERE id = ?', (pgn_id,))
                pgn_name = cursor.fetchone()[0]
                print(f"   📁 PGN ID {pgn_id} ({pgn_name}):")
                current_pgn = pgn_id
            status = "✅已完成" if is_completed else "🔄进行中"
            print(f"      - {branch_id}: {correct_count}/{total_attempts} {status}")
    else:
        print(f"   无学习进度记录")
    
    conn.close()
    print("\n" + "=" * 60)
    print("🔍 调试完成！")

if __name__ == "__main__":
    debug_progress_display() 