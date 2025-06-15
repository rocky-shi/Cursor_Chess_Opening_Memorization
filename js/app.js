$(document).ready(function() {
    console.log('Document ready');
    
    // 创建国际象棋实例
    window.chessBoard = new ChessBoard();
    
    // 隐藏加载屏幕并显示主内容
    setTimeout(async () => {
        $('#loadingScreen').fadeOut(300, async () => {
            $('#mainContainer').fadeIn(300, async () => {
                console.log('Main container visible, initializing chess board...');
                // 在主容器显示后初始化棋盘
                window.chessBoard.init();
                
                // 初始化API（检测后端连接和加载本地存储）
                const hasStoredData = await window.chessAPI.init();
                
                // 移动端UI优化
                if (/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)) {
                    // 隐藏移动端不需要的按钮
                    const loadPgnBtn = document.getElementById('loadPgn');
                    const clearStorageBtn = document.getElementById('clearStorage');
                    
                    if (loadPgnBtn) {
                        loadPgnBtn.style.display = 'none';
                        console.log('移动端：隐藏加载对局按钮');
                    }
                    if (clearStorageBtn) {
                        clearStorageBtn.style.display = 'none';
                        console.log('移动端：隐藏清除棋谱按钮');
                    }
                }
                
                // 更新UI状态
                updateUI();
                
                // 如果从本地存储恢复了数据，再次确保UI正确更新
                if (hasStoredData && window.pgnParser) {
                    console.log('检测到本地存储数据，确保UI正确更新');
                    setTimeout(() => {
                        updateUI();
                        console.log('UI更新完成，当前状态:', {
                            hasPgnParser: !!window.pgnParser,
                            branchCount: window.pgnParser?.branches?.length,
                            startButtonDisabled: $('#startStudy').prop('disabled')
                        });
                    }, 500);
                }
                
                // 调试信息（可以在移动端控制台查看）
                setTimeout(() => {
                    window.chessAPI.debugStorage();
                }, 1000);
                
                // 在移动端显示连接状态（方便调试）
                if (/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)) {
                    setTimeout(() => {
                        const connectionStatus = window.chessAPI.isBackendAvailable ? '✅ 已连接' : '❌ 未连接';
                        const apiUrl = window.chessAPI.baseURL;
                        console.log(`🔗 移动端连接状态: ${connectionStatus}`);
                        console.log(`📡 API地址: ${apiUrl}`);
                        
                        // 在页面显示连接状态
                        const statusElement = document.getElementById('connectionStatus');
                        if (statusElement) {
                            if (window.chessAPI.isBackendAvailable) {
                                statusElement.innerHTML = '🌐 服务端已连接';
                                statusElement.style.color = '#4CAF50';
                            } else {
                                statusElement.innerHTML = '❌ 服务端未连接 (仅本地模式)';
                                statusElement.style.color = '#f44336';
                                showNotification(`后端连接失败: ${apiUrl}`, 'error');
                            }
                        }
                    }, 2000);
                } else {
                    // 桌面端也显示连接状态
                    setTimeout(() => {
                        const statusElement = document.getElementById('connectionStatus');
                        if (statusElement) {
                            if (window.chessAPI.isBackendAvailable) {
                                statusElement.innerHTML = '🌐 服务端已连接';
                                statusElement.style.color = '#4CAF50';
                            } else {
                                statusElement.innerHTML = '❌ 服务端未连接';
                                statusElement.style.color = '#f44336';
                            }
                        }
                    }, 2000);
                }
            });
        });
    }, 1000);

    // 加载PGN文件
    $('#loadPgn').click(function() {
        $('#pgnInput').click();
    });

    $('#pgnInput').change(function(e) {
        const file = e.target.files[0];
        if (file) {
            console.log('用户选择了文件:', file.name);
            
            // 显示加载状态
            $('#loadPgn').prop('disabled', true).text('解析中...');
            
            // 记录解析开始时间
            const startTime = Date.now();
            
            // 使用API类上传文件
            window.chessAPI.uploadPGN(file)
                .then(function(response) {
                    const duration = Date.now() - startTime;
                    console.log('PGN解析成功, 耗时:', duration + 'ms');
                    
                    // 验证解析结果
                    if (!response.branches || response.branches.length === 0) {
                        throw new Error('解析结果中没有找到有效的分支数据');
                    }
                    
                    // 存储解析结果
                    window.pgnParser = response;
                    
                    // 重置棋盘状态
                    window.chessBoard.completedBranches.clear();
                    window.chessBoard.computerUsedBranches.clear();
                    
                    // 加载用户进度
                    if (window.chessBoard && typeof window.chessBoard.loadUserProgress === 'function') {
                        setTimeout(async () => {
                            await window.chessBoard.loadUserProgress();
                        }, 500);
                    }
                    
                    // 更新UI
                    updateUI();
                    
                    // 显示成功消息
                    showNotification(`成功加载 ${response.branches.length} 个分支！`, 'success');
                })
                .catch(function(error) {
                    console.error('PGN解析失败:', error);
                    
                    // 提供更具体的错误信息
                    let errorMessage = 'PGN文件解析失败！';
                    
                    if (error.message.includes('后端服务不可用')) {
                        errorMessage = '后端服务未启动，请先运行start_backend.bat';
                    } else if (error.message.includes('网络')) {
                        errorMessage = '网络连接问题，请检查网络后重试';
                    } else {
                        errorMessage += ' 错误详情: ' + error.message;
                    }
                    
                    showNotification(errorMessage, 'error');
                })
                .finally(function() {
                    // 恢复按钮状态
                    $('#loadPgn').prop('disabled', false).text('📁 加载对局');
                    
                    // 清空文件输入，允许重新选择同一文件
                    $('#pgnInput').val('');
                });
        } else {
            console.log('用户取消了文件选择');
        }
    });

    // 开始背谱
    $('#startStudy').click(async function() {
        const success = await window.chessBoard.startStudy();
        if (success) {
            updateButtonStates(true);
        }
    });

    // 重置位置
    $('#resetPosition').click(function() {
        // 重置位置但不重置正确率（保持累积）
        window.chessBoard.resetPosition(false);
    });

    // 完全重置
    $('#resetAll').click(async function() {
        // 停止背谱模式
        window.chessBoard.stopStudy();
        
        // 如果有后端连接和PGN数据，调用后端重置API
        if (window.chessAPI && window.chessAPI.isBackendAvailable && window.pgnParser?.metadata?.id) {
            try {
                const response = await fetch(`${window.chessAPI.baseURL}/progress/reset`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    credentials: 'include',
                    body: JSON.stringify({
                        pgn_game_id: window.pgnParser.metadata.id
                    })
                });

                if (response.ok) {
                    const result = await response.json();
                    if (result.success) {
                        showNotification(result.message, 'success');
                        
                        // 重新加载用户进度，保留已完成的分支
                        await window.chessBoard.loadUserProgress();
                    }
                } else {
                    console.error('重置进度失败:', response.status, response.statusText);
                    showNotification('重置进度失败，请重试', 'error');
                }
            } catch (error) {
                console.error('重置进度请求失败:', error);
                showNotification('网络错误，重置进度失败', 'error');
            }
        } else {
            // 本地模式，清理本地状态（但不影响已完成的分支）
            // 只清理未完成的分支记录
            console.log('本地模式：只清理未完成的分支状态');
        }
        
        // 清理当前背诵状态
        window.chessBoard.computerUsedBranches.clear();
        
        // 重置正确率统计
        window.chessBoard.correctMoves = 0;
        window.chessBoard.totalMoves = 0;
        window.chessBoard.updateAccuracy();
        
        // 重置游戏状态（并重置正确率）
        window.chessBoard.resetPosition(true);
        
        // 更新UI（不清空PGN数据）
        updateUI();
        
        // 隐藏完成横幅
        $('#completionBanner').hide();
        
        showNotification('已重置背诵状态，棋谱数据保留', 'success');
    });

    // 清除本地存储
    $('#clearStorage').click(function() {
        if (confirm('确定要清除保存的棋谱数据吗？此操作不可恢复。')) {
            // 清除本地存储
            window.chessAPI.clearStorage();
            
            // 清除当前加载的数据
            window.pgnParser = null;
            
            // 重置棋盘状态
            window.chessBoard.completedBranches.clear();
            window.chessBoard.computerUsedBranches.clear();
            window.chessBoard.stopStudy();
            
            // 重置正确率统计
            window.chessBoard.correctMoves = 0;
            window.chessBoard.totalMoves = 0;
            window.chessBoard.updateAccuracy();
            
            window.chessBoard.resetPosition(true);
            
            // 更新UI
            updateUI();
            
            // 隐藏完成横幅
            $('#completionBanner').hide();
            
            showNotification('已清除所有棋谱数据', 'success');
        }
    });

    // 监听颜色选择变化
    $('input[name="color"]').change(function() {
        const selectedColor = $(this).val();
        window.chessBoard.setOrientation(selectedColor);
        
        // 如果正在背谱模式，需要重新开始
        if (window.chessBoard.isStudyMode) {
            window.chessBoard.startStudy();
        }
    });

    function updateUI() {
        if (window.pgnParser && window.pgnParser.branches) {
            // 启用开始背谱按钮
            $('#startStudy').prop('disabled', false);
            
            // 更新进度显示
            window.chessBoard.updateProgress();
        } else {
            // 禁用开始背谱按钮
            $('#startStudy').prop('disabled', true);
            
            // 重置进度显示
            $('#totalBranches').text('0');
            $('#completedBranches').text('0');
            $('#progress').text('0%');
            $('#accuracy').text('0%').css('color', '#2196F3');
        }
        
        // 更新按钮状态
        updateButtonStates(window.chessBoard.isStudyMode);
    }

    function updateButtonStates(isStudying) {
        if (isStudying) {
            $('#startStudy').text('🛑 停止背谱').off('click').click(function() {
                const success = window.chessBoard.stopStudy();
                if (success) {
                    updateButtonStates(false);
                    showNotification('已停止背谱模式', 'success');
                }
            });
        } else {
            $('#startStudy').text('🎯 开始背谱').off('click').click(async function() {
                const success = await window.chessBoard.startStudy();
                if (success) {
                    updateButtonStates(true);
                }
            });
        }
    }

    // 将showNotification函数暴露给全局，供API类使用
    window.showNotification = function(message, type = 'success') {
        // 移除现有的通知
        $('.notification').remove();
        
        // 创建新通知
        const notification = $(`
            <div class="notification ${type}">
                ${message}
            </div>
        `);
        
        $('body').append(notification);
        
        // 显示动画
        setTimeout(() => {
            notification.addClass('show');
        }, 10);
        
        // 3秒后隐藏
        setTimeout(() => {
            notification.removeClass('show');
            setTimeout(() => {
                notification.remove();
            }, 400);
        }, 3000);
    }

    // 初始化UI状态
    updateUI();
}); 