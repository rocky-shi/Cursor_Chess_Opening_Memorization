#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
网络连接测试脚本
用于测试后端服务的网络访问性
"""

import requests
import socket
import sys

def get_local_ip():
    """获取本机IP地址"""
    try:
        # 连接到一个远程地址来获取本机IP
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        local_ip = s.getsockname()[0]
        s.close()
        return local_ip
    except Exception as e:
        print(f"获取本机IP失败: {e}")
        return None

def test_port_accessible(host, port):
    """测试端口是否可访问"""
    try:
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.settimeout(5)
        result = sock.connect_ex((host, port))
        sock.close()
        return result == 0
    except Exception as e:
        print(f"端口测试失败: {e}")
        return False

def test_api_endpoint(base_url):
    """测试API端点"""
    try:
        # 测试健康检查端点
        health_url = f"{base_url}/api/health"
        print(f"测试健康检查: {health_url}")
        
        response = requests.get(health_url, timeout=10)
        if response.status_code == 200:
            print("✅ 健康检查成功")
            print(f"响应: {response.json()}")
            return True
        else:
            print(f"❌ 健康检查失败: {response.status_code}")
            return False
    except requests.exceptions.RequestException as e:
        print(f"❌ API请求失败: {e}")
        return False

def main():
    print("=" * 50)
    print("国际象棋开局记忆系统 - 网络连接测试")
    print("=" * 50)
    
    # 获取本机IP
    local_ip = get_local_ip()
    if local_ip:
        print(f"🌐 本机IP地址: {local_ip}")
    else:
        print("❌ 无法获取本机IP地址")
        return
    
    port = 24377
    print(f"🔌 测试端口: {port}")
    
    # 测试本地访问
    print("\n1. 测试本地访问...")
    if test_port_accessible("127.0.0.1", port):
        print("✅ 本地端口可访问")
        if test_api_endpoint("http://127.0.0.1:24377"):
            print("✅ 本地API正常")
        else:
            print("❌ 本地API异常")
    else:
        print("❌ 本地端口不可访问")
        print("请确保后端服务已启动!")
        return
    
    # 测试网络访问
    print(f"\n2. 测试网络访问...")
    if test_port_accessible(local_ip, port):
        print("✅ 网络端口可访问")
        if test_api_endpoint(f"http://{local_ip}:24377"):
            print("✅ 网络API正常")
        else:
            print("❌ 网络API异常")
    else:
        print("❌ 网络端口不可访问")
        print("可能的原因:")
        print("  - 防火墙阻止了端口访问")
        print("  - 服务未正确绑定到0.0.0.0")
    
    print(f"\n📱 其他设备访问地址: http://{local_ip}:24377")
    print("\n🔧 故障排除建议:")
    print("1. 确保后端服务正在运行")
    print("2. 检查Windows防火墙设置")
    print("3. 确保所有设备在同一网络")
    print("4. 尝试临时关闭防火墙测试")

if __name__ == "__main__":
    main() 