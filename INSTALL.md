# 国际象棋开局背谱系统 - 快速安装指南

## 🚀 一键启动（推荐）

### Windows用户
1. 双击运行 `start_backend.bat`
2. 等待服务启动完成
3. 浏览器访问：`http://localhost:5000`
4. 使用默认账号登录：`admin / admin123`

### Linux/Mac用户
```bash
cd backend
pip install -r requirements.txt
python app.py
```

## 📱 移动端访问

1. 确保手机和电脑在同一WiFi网络
2. 获取电脑IP地址：
   ```bash
   # Windows
   ipconfig
   
   # Linux/Mac
   ifconfig
   ```
3. 手机浏览器访问：`http://电脑IP:5000`
4. 使用相同账号登录

## 🔐 首次使用

1. **登录系统**：`admin / admin123`
2. **修改密码**：强烈建议立即修改默认密码
3. **创建用户**：在管理员面板创建其他用户账号
4. **上传棋谱**：上传PGN文件
5. **权限管理**：为用户授权可访问的PGN文件

## ⚠️ 常见问题

**Q: 无法启动服务？**
A: 确保Python 3.7+已安装，运行 `pip install -r backend/requirements.txt`

**Q: 移动端无法访问？**  
A: 检查防火墙设置，确保5000端口开放

**Q: 忘记管理员密码？**
A: 删除 `backend/chess_pgn.db` 文件重新启动服务

## 📞 获取帮助

详细文档请参考：
- [README.md](README.md) - 完整功能说明
- [README_用户系统.md](README_用户系统.md) - 用户系统详解

---

🎯 **开始你的国际象棋开局学习之旅！** 