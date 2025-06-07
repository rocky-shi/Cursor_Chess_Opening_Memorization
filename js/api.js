class ChessAPI {
    constructor() {
        // 自动获取当前页面的协议、域名和端口
        const currentProtocol = window.location.protocol;
        const currentHost = window.location.hostname;
        const currentPort = window.location.port || (currentProtocol === 'https:' ? '443' : '80');
        
        // 如果是通过file://协议打开的，默认使用localhost:5000
        if (currentProtocol === 'file:') {
            this.baseURL = 'http://localhost:5000/api';
        } else {
            // 使用当前访问的域名和端口
            this.baseURL = `${currentProtocol}//${currentHost}:${currentPort}/api`;
        }
        
        console.log('API基础URL:', this.baseURL);
        this.isBackendAvailable = false;
        this.storageKey = 'chess_memorization_data';
    }

    async init() {
        console.log('初始化ChessAPI...');
        
        // 检测后端连接状态
        await this.checkBackendConnection();
        
        let hasData = false;
        
        // 如果后端可用，优先尝试获取服务端最新棋谱
        if (this.isBackendAvailable) {
            console.log('后端可用，尝试获取服务端最新棋谱...');
            const serverData = await this.loadLatestFromServer();
            if (serverData) {
                hasData = true;
                console.log('成功从服务端获取最新棋谱');
            }
        }
        
        // 如果服务端没有数据，尝试从本地存储恢复
        if (!hasData) {
            console.log('尝试从本地存储加载数据...');
            const localData = this.loadFromStorage();
            if (localData) {
                hasData = true;
                console.log('成功从本地存储恢复数据');
            }
        }
        
        if (hasData) {
            console.log('数据加载成功');
        } else {
            console.log('没有找到任何棋谱数据');
        }
        
        return hasData;
    }

    async checkBackendConnection() {
        console.log('开始检测后端连接...');
        console.log('目标URL:', `${this.baseURL}/health`);
        console.log('当前页面信息:', {
            protocol: window.location.protocol,
            hostname: window.location.hostname,
            port: window.location.port,
            href: window.location.href
        });
        
        try {
            const startTime = Date.now();
            const response = await fetch(`${this.baseURL}/health`, {
                method: 'GET',
                timeout: 5000
            });
            
            const duration = Date.now() - startTime;
            this.isBackendAvailable = response.ok;
            
            console.log('后端连接检测结果:', {
                available: this.isBackendAvailable,
                status: response.status,
                statusText: response.statusText,
                duration: duration + 'ms'
            });
            
            if (this.isBackendAvailable) {
                const healthData = await response.json();
                console.log('健康检查响应:', healthData);
            }
            
        } catch (error) {
            this.isBackendAvailable = false;
            console.error('后端连接失败:', {
                error: error.message,
                type: error.name,
                targetUrl: `${this.baseURL}/health`
            });
            
            // 提供更具体的错误信息
            if (error.message.includes('Failed to fetch') || error.message.includes('fetch')) {
                console.warn('可能的原因:', [
                    '1. 后端服务未启动',
                    '2. 网络连接问题',
                    '3. 防火墙阻止连接',
                    '4. IP地址或端口不正确',
                    '5. CORS跨域问题'
                ]);
            }
        }
        
        // 更新UI状态
        this.updateUIBasedOnBackend();
    }

    updateUIBasedOnBackend() {
        const loadPgnBtn = document.getElementById('loadPgn');
        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        
        if (!this.isBackendAvailable) {
            // 后端不可用时隐藏加载按钮
            if (loadPgnBtn && !isMobile) {
                // 桌面端：后端不可用时隐藏
                loadPgnBtn.style.display = 'none';
            }
            console.log('后端不可用，隐藏加载对局按钮');
        } else {
            // 后端可用时显示加载按钮（但移动端仍然隐藏）
            if (loadPgnBtn && !isMobile) {
                // 只有桌面端在后端可用时才显示
                loadPgnBtn.style.display = 'block';
                console.log('后端可用，显示加载对局按钮');
            } else if (isMobile) {
                // 移动端始终隐藏
                if (loadPgnBtn) {
                    loadPgnBtn.style.display = 'none';
                }
                console.log('移动端：始终隐藏加载对局按钮');
            }
        }
    }

    async uploadPGN(file) {
        if (!this.isBackendAvailable) {
            throw new Error('后端服务不可用，无法上传PGN文件');
        }

        try {
            console.log('开始上传PGN文件:', {
                fileName: file.name,
                fileSize: file.size,
                fileType: file.type
            });

            // 只使用后端API解析
            const result = await this.parseWithBackend(file);
            console.log('后端解析成功:', result);
            
            // 保存到本地存储
            this.saveToStorage(result, {
                fileName: file.name,
                uploadTime: new Date().toISOString()
            });
            
            return result;
        } catch (error) {
            console.error('PGN解析失败:', error);
            throw error;
        }
    }

    async parseWithBackend(file) {
        const formData = new FormData();
        formData.append('file', file);

        const response = await fetch(`${this.baseURL}/parse-pgn`, {
            method: 'POST',
            body: formData
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        return data;
    }

    saveToStorage(pgnData, metadata) {
        try {
            const storageData = {
                pgnData: pgnData,
                metadata: metadata,
                saveTime: new Date().toISOString()
            };
            
            localStorage.setItem(this.storageKey, JSON.stringify(storageData));
            console.log('棋谱数据已保存到本地存储:', metadata.fileName);
        } catch (error) {
            console.error('保存到本地存储失败:', error);
        }
    }

    loadFromStorage() {
        console.log('开始从本地存储加载数据...');
        
        try {
            const storedData = localStorage.getItem(this.storageKey);
            console.log('localStorage中的原始数据:', storedData ? '存在' : '不存在');
            
            if (storedData) {
                const parsedData = JSON.parse(storedData);
                console.log('解析本地存储数据成功:', {
                    hasMetadata: !!parsedData.metadata,
                    hasPgnData: !!parsedData.pgnData,
                    fileName: parsedData.metadata?.fileName,
                    uploadTime: parsedData.metadata?.uploadTime,
                    branchCount: parsedData.pgnData?.branches?.length
                });
                
                // 恢复棋谱数据到全局变量
                if (parsedData.pgnData && parsedData.pgnData.branches) {
                    window.pgnParser = parsedData.pgnData;
                    console.log('已恢复棋谱数据到window.pgnParser，分支数量:', parsedData.pgnData.branches.length);
                    
                    // 显示加载的棋谱信息
                    if (parsedData.metadata && parsedData.metadata.fileName) {
                        this.showStorageLoadNotification(parsedData.metadata);
                    }
                    
                    return parsedData;
                } else {
                    console.warn('本地存储的数据结构不完整');
                    return null;
                }
            } else {
                console.log('localStorage中没有找到棋谱数据');
                return null;
            }
        } catch (error) {
            console.error('从本地存储加载失败:', error);
            // 如果数据损坏，清除它
            try {
                localStorage.removeItem(this.storageKey);
                console.log('已清除损坏的本地存储数据');
            } catch (clearError) {
                console.error('清除损坏数据失败:', clearError);
            }
            return null;
        }
    }

    showStorageLoadNotification(metadata) {
        console.log('准备显示恢复通知:', metadata);
        
        // 延迟显示通知，确保页面已加载完成
        setTimeout(() => {
            console.log('开始显示恢复通知...');
            
            if (typeof window.showNotification === 'function') {
                const uploadDate = new Date(metadata.uploadTime).toLocaleDateString('zh-CN');
                const message = `已自动加载棋谱: ${metadata.fileName} (${uploadDate})`;
                console.log('显示通知消息:', message);
                window.showNotification(message, 'success');
            } else {
                console.warn('showNotification函数不存在，尝试直接创建通知');
                // 如果showNotification还没有定义，直接创建通知
                this.createDirectNotification(metadata);
            }
        }, 2000); // 增加延迟时间确保页面完全加载
    }
    
    createDirectNotification(metadata, isFromServer = false) {
        try {
            const uploadDate = new Date(metadata.uploadTime || metadata.upload_time).toLocaleDateString('zh-CN');
            const prefix = isFromServer ? '已自动加载服务端最新棋谱' : '已自动加载棋谱';
            const fileName = metadata.fileName || metadata.filename;
            const message = `${prefix}: ${fileName} (${uploadDate})`;
            
            // 直接创建通知元素
            const notification = document.createElement('div');
            notification.className = 'notification success show';
            notification.textContent = message;
            notification.style.cssText = `
                position: fixed;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                padding: 20px 40px;
                border-radius: 12px;
                color: white;
                font-weight: 600;
                font-size: 16px;
                z-index: 1000;
                background: linear-gradient(135deg, #4CAF50, #45a049);
                box-shadow: 0 8px 25px rgba(76, 175, 80, 0.4);
                max-width: 500px;
                text-align: center;
            `;
            
            document.body.appendChild(notification);
            console.log('直接创建通知成功');
            
            // 3秒后移除
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 3000);
        } catch (error) {
            console.error('创建直接通知失败:', error);
        }
    }

    clearStorage() {
        try {
            localStorage.removeItem(this.storageKey);
            console.log('已清除本地存储的棋谱数据');
        } catch (error) {
            console.error('清除本地存储失败:', error);
        }
    }

    hasStoredData() {
        return localStorage.getItem(this.storageKey) !== null;
    }

    // 测试和调试函数
    debugStorage() {
        console.log('=== 本地存储调试信息 ===');
        console.log('存储键:', this.storageKey);
        console.log('后端连接状态:', this.isBackendAvailable ? '可用' : '不可用');
        
        try {
            const rawData = localStorage.getItem(this.storageKey);
            console.log('本地原始数据存在:', !!rawData);
            
            if (rawData) {
                console.log('本地原始数据长度:', rawData.length);
                const parsedData = JSON.parse(rawData);
                console.log('本地解析后的数据结构:', {
                    hasMetadata: !!parsedData.metadata,
                    hasPgnData: !!parsedData.pgnData,
                    fileName: parsedData.metadata?.fileName,
                    uploadTime: parsedData.metadata?.uploadTime,
                    saveTime: parsedData.saveTime,
                    branchCount: parsedData.pgnData?.branches?.length,
                    gameCount: parsedData.pgnData?.games?.length
                });
            }
            
            console.log('当前window.pgnParser状态:', {
                exists: !!window.pgnParser,
                branchCount: window.pgnParser?.branches?.length,
                hasMetadata: !!window.pgnParser?.metadata,
                dataSource: window.pgnParser?.metadata ? '服务端' : '本地或未知'
            });
            
            // 如果后端可用，也测试服务端连接
            if (this.isBackendAvailable) {
                this.testServerData();
            }
            
        } catch (error) {
            console.error('调试存储时出错:', error);
        }
        console.log('=== 调试信息结束 ===');
    }

    async testServerData() {
        try {
            console.log('=== 测试服务端数据 ===');
            const response = await fetch(`${this.baseURL}/latest-pgn`);
            if (response.ok) {
                const data = await response.json();
                console.log('服务端最新数据:', {
                    fileName: data.metadata?.filename,
                    uploadTime: data.metadata?.upload_time,
                    branchCount: data.branches?.length,
                    totalGames: data.metadata?.total_games
                });
            } else {
                console.log('服务端数据状态:', response.status, response.statusText);
            }
        } catch (error) {
            console.error('测试服务端数据失败:', error);
        }
    }

    async testConnection() {
        return this.isBackendAvailable;
    }

    async getTreeStructure() {
        if (!this.isBackendAvailable) {
            throw new Error('后端服务不可用');
        }

        try {
            const response = await fetch(`${this.baseURL}/test-tree`);
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            return data;
        } catch (error) {
            console.error('获取树状结构错误:', error);
            throw error;
        }
    }

    async loadLatestFromServer() {
        if (!this.isBackendAvailable) {
            console.log('后端不可用，跳过服务端数据加载');
            return null;
        }
        
        try {
            console.log('从服务端获取最新棋谱...');
            console.log('请求URL:', `${this.baseURL}/latest-pgn`);
            
            const startTime = Date.now();
            const response = await fetch(`${this.baseURL}/latest-pgn`, {
                method: 'GET'
            });
            
            const duration = Date.now() - startTime;
            console.log('服务端请求完成:', {
                status: response.status,
                statusText: response.statusText,
                ok: response.ok,
                duration: duration + 'ms'
            });
            
            if (response.ok) {
                const data = await response.json();
                console.log('服务端返回的数据:', {
                    hasMetadata: !!data.metadata,
                    fileName: data.metadata?.filename,
                    uploadTime: data.metadata?.upload_time,
                    branchCount: data.branches?.length,
                    hasTree: !!data.tree,
                    success: data.success
                });
                
                // 恢复棋谱数据到全局变量
                if (data.branches && data.branches.length > 0) {
                    window.pgnParser = data;
                    console.log('✅ 已恢复服务端棋谱数据到window.pgnParser，分支数量:', data.branches.length);
                    
                    // 显示加载的棋谱信息
                    if (data.metadata) {
                        this.showServerLoadNotification(data.metadata);
                    }
                    
                    return data;
                } else {
                    console.warn('服务端返回的数据中没有有效的分支');
                    return null;
                }
            } else if (response.status === 404) {
                console.log('服务端没有找到PGN数据 (404)');
                return null;
            } else {
                console.error('获取服务端数据失败:', {
                    status: response.status,
                    statusText: response.statusText,
                    url: `${this.baseURL}/latest-pgn`
                });
                return null;
            }
        } catch (error) {
            console.error('从服务端加载最新棋谱失败:', {
                error: error.message,
                type: error.name,
                stack: error.stack,
                url: `${this.baseURL}/latest-pgn`
            });
            return null;
        }
    }

    showServerLoadNotification(metadata) {
        console.log('准备显示服务端恢复通知:', metadata);
        
        // 延迟显示通知，确保页面已加载完成
        setTimeout(() => {
            console.log('开始显示服务端恢复通知...');
            
            if (typeof window.showNotification === 'function') {
                const uploadDate = new Date(metadata.upload_time).toLocaleDateString('zh-CN');
                const message = `已自动加载服务端最新棋谱: ${metadata.filename} (${uploadDate})`;
                console.log('显示通知消息:', message);
                window.showNotification(message, 'success');
            } else {
                console.warn('showNotification函数不存在，尝试直接创建通知');
                // 如果showNotification还没有定义，直接创建通知
                this.createDirectNotification({
                    fileName: metadata.filename,
                    uploadTime: metadata.upload_time
                }, true);
            }
        }, 2000); // 增加延迟时间确保页面完全加载
    }
}

// 创建全局实例
window.chessAPI = new ChessAPI(); 