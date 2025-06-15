#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
测试学习进度中总尝试数的计算是否正确

该脚本用于验证修复后的SQL查询是否正确计算所有分支的总尝试数之和
"""

import sqlite3
import sys
import os

# 添加父目录到路径以导入app模块
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

DATABASE_PATH = 'chess_pgn.db'

def test_progress_calculation():
    """测试学习进度计算"""
    
    if not os.path.exists(DATABASE_PATH):
        print("❌ 数据库文件不存在，请先启动应用并创建一些测试数据")
        return
    
    conn = sqlite3.connect(DATABASE_PATH)
    cursor = conn.cursor()
    
    print("🔍 测试学习进度中的总尝试数计算...")
    print("=" * 60)
    
    # 获取所有有进度记录的用户
    cursor.execute('''
        SELECT DISTINCT user_id, username 
        FROM user_progress up
        JOIN users u ON up.user_id = u.id
    ''')
    users = cursor.fetchall()
    
    if not users:
        print("❌ 没有找到任何学习进度记录")
        conn.close()
        return
    
    for user_id, username in users:
        print(f"\n👤 用户: {username} (ID: {user_id})")
        
        # 获取该用户的PGN列表
        cursor.execute('''
            SELECT DISTINCT pgn_game_id
            FROM user_progress 
            WHERE user_id = ?
        ''', (user_id,))
        pgn_ids = cursor.fetchall()
        
        for pgn_id_tuple in pgn_ids:
            pgn_id = pgn_id_tuple[0]
            
            # 获取PGN名称
            cursor.execute('SELECT filename FROM pgn_games WHERE id = ?', (pgn_id,))
            pgn_info = cursor.fetchone()
            pgn_filename = pgn_info[0] if pgn_info else f"PGN_{pgn_id}"
            
            print(f"\n📁 PGN: {pgn_filename} (ID: {pgn_id})")
            
            # 方法1: 直接SUM所有分支的total_attempts (修复后的方法)
            cursor.execute('''
                SELECT 
                    COUNT(*) as branch_count,
                    SUM(COALESCE(correct_count, 0)) as total_correct,
                    SUM(COALESCE(total_attempts, 0)) as total_attempts
                FROM user_progress 
                WHERE user_id = ? AND pgn_game_id = ?
            ''', (user_id, pgn_id))
            
            summary_stats = cursor.fetchone()
            branch_count, total_correct_sum, total_attempts_sum = summary_stats
            
            # 方法2: 逐个分支计算然后手动求和 (验证方法)
            cursor.execute('''
                SELECT 
                    branch_id,
                    COALESCE(correct_count, 0) as correct_count,
                    COALESCE(total_attempts, 0) as total_attempts
                FROM user_progress 
                WHERE user_id = ? AND pgn_game_id = ?
                ORDER BY branch_id
            ''', (user_id, pgn_id))
            
            branches = cursor.fetchall()
            manual_total_correct = sum(row[1] for row in branches)
            manual_total_attempts = sum(row[2] for row in branches)
            
            # 比较两种方法的结果
            print(f"   📊 分支数量: {branch_count}")
            print(f"   🎯 SQL SUM方法 - 总正确: {total_correct_sum}, 总尝试: {total_attempts_sum}")
            print(f"   🔢 手动求和方法 - 总正确: {manual_total_correct}, 总尝试: {manual_total_attempts}")
            
            # 验证结果是否一致
            if total_correct_sum == manual_total_correct and total_attempts_sum == manual_total_attempts:
                print("   ✅ 计算结果一致！")
            else:
                print("   ❌ 计算结果不一致！")
            
            # 计算正确率
            if total_attempts_sum > 0:
                accuracy_rate = (total_correct_sum / total_attempts_sum * 100)
                print(f"   📈 正确率: {accuracy_rate:.1f}%")
            else:
                print("   📈 正确率: N/A (无尝试记录)")
            
            # 显示各分支详情
            print("   📋 分支详情:")
            for branch_id, correct, attempts in branches:
                branch_accuracy = (correct / attempts * 100) if attempts > 0 else 0
                print(f"      - {branch_id}: {correct}/{attempts} ({branch_accuracy:.1f}%)")
    
    conn.close()
    print("\n" + "=" * 60)
    print("🔍 测试完成！")

if __name__ == "__main__":
    test_progress_calculation() 