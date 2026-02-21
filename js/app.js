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
                
                // 检查URL参数，如果有pgn_id，直接加载特定的PGN数据
                const urlParams = new URLSearchParams(window.location.search);
                const pgnId = urlParams.get('pgn_id');
                
                let hasStoredData = false;
                
                if (pgnId) {
                    console.log('检测到PGN ID参数，直接加载特定棋谱:', pgnId);
                    // 只初始化API连接，不自动加载服务端最新棋谱
                    await window.chessAPI.checkBackendConnection();
                    // 加载特定的PGN数据
                    await loadPGNById(parseInt(pgnId));
                    hasStoredData = true;
                } else {
                    // 没有PGN ID时，进行正常的初始化（包括自动加载服务端最新棋谱）
                    hasStoredData = await window.chessAPI.init();
                }
                
                // 移动端UI优化（按钮已移除，保留注释以备将来使用）
                if (/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)) {
                    console.log('移动端设备检测');
                }
                
                // 更新UI状态
                updateUI();
                
                // 如果从本地存储恢复了数据，再次确保UI正确更新
                if (hasStoredData && window.pgnParser) {
                    console.log('检测到数据，确保UI正确更新');
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



    // 开始背谱
    $('#startStudy').click(async function() {
        const success = await window.chessBoard.startStudy();
        if (success) {
            updateButtonStates();
        }
    });

    // 摆棋学习
    $('#setupLearning').click(async function() {
        console.log('摆棋学习按钮被点击');
        
        // 检测是否为移动端
        const isMobile = window.innerWidth <= 768;
        console.log('移动端检测:', isMobile, '屏幕宽度:', window.innerWidth);
        
        const success = await window.chessBoard.startSetupLearning();
        if (success) {
            updateButtonStates();
            
            // 移动端特殊处理：延迟检查棋谱显示
            if (isMobile) {
                console.log('移动端摆棋学习：延迟检查棋谱显示');
                setTimeout(() => {
                    const moveHistoryElement = $('#moveHistory');
                    const branchElements = moveHistoryElement.find('[id^="branch-"]');
                    
                    console.log('移动端棋谱显示检查:');
                    console.log('分支元素数量:', branchElements.length);
                    console.log('预期分支数量:', window.pgnParser?.branches?.length || 0);
                    
                    if (branchElements.length === 0) {
                        console.warn('移动端：没有找到分支元素，尝试强制刷新');
                        // 尝试强制刷新棋谱显示
                        if (window.chessBoard.forceRefreshNotation) {
                            window.chessBoard.forceRefreshNotation();
                        }
                    }
                }, 1000);
            }
        }
    });

    // 记忆学习
    $('#memoryLearning').click(async function() {
        const success = await window.chessBoard.startMemoryLearning();
        if (success) {
            updateButtonStates();
        }
    });
    
    // 绑定"从公共部分开始"复选框事件
    $('#startFromCommon').change(function() {
        window.chessBoard.startFromCommon = $(this).is(':checked');
        console.log('从公共部分开始选项已', window.chessBoard.startFromCommon ? '启用' : '禁用');
    });

    // 重置位置
    $('#resetPosition').click(function() {
        console.log('回到初始位置按钮被点击');
        
        // 检查当前学习模式
        const isSetupLearning = window.chessBoard.isSetupLearningMode;
        const isMemoryLearning = window.chessBoard.isMemoryLearningMode;
        const isStudyMode = window.chessBoard.isStudyMode;
        
        if (isSetupLearning) {
            console.log('摆棋学习模式：回到初始位置');
            
            // 检查是否有分支完成
            const completedBranch = window.chessBoard.checkForCompletedBranches();
            let notificationMessage = '✅ 已回到初始位置，所有分支现在都可用';
            
            if (completedBranch) {
                notificationMessage = `✅ 已回到初始位置，分支 ${completedBranch.branchIndex + 1} 已完成，所有分支现在都可用`;
            }
            
            // 摆棋学习模式：重置位置并清空隐藏分支状态
            window.chessBoard.resetPosition(false);
            
            // 显示成功提示
            showNotification(notificationMessage, 'success');
        } else if (isMemoryLearning) {
            console.log('记忆学习模式：回到初始位置');
            // 记忆学习模式：重置位置但保留学习进度
            window.chessBoard.resetPosition(false);
            
            // 显示成功提示
            showNotification('✅ 已回到初始位置，记忆学习进度已保留', 'success');
        } else if (isStudyMode) {
            console.log('背诵学习模式：回到初始位置');
            // 背诵学习模式：重置位置但不重置正确率（保持累积）
            window.chessBoard.resetPosition(false);
            
            // 显示成功提示
            showNotification('✅ 已回到初始位置，背诵进度已保留', 'success');
        } else {
            console.log('自由模式：回到初始位置');
            // 自由模式：简单重置位置
            window.chessBoard.resetPosition(false);
            
            // 显示成功提示
            showNotification('✅ 已回到初始位置', 'success');
        }
    });

    // 完全重置
    $('#resetAll').click(async function() {
        // 停止背谱模式
        window.chessBoard.stopStudy();
        
        // 检查当前学习模式
        const isMemoryLearning = window.chessBoard.isMemoryLearningMode;
        
        // 如果有后端连接和PGN数据，调用后端重置API
        if (window.chessAPI && window.chessAPI.isBackendAvailable && window.pgnParser?.metadata?.id) {
            try {
                let resetEndpoint = '/progress/reset';
                let resetMessage = '已重置背诵状态，棋谱数据保留';
                
                if (isMemoryLearning) {
                    // 记忆学习模式：重置暂停的分支
                    resetEndpoint = '/progress/reset-paused';
                    resetMessage = '已重置暂停的分支，可以重新学习';
                }
                
                const response = await fetch(`${window.chessAPI.baseURL}${resetEndpoint}`, {
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
                        
                        if (isMemoryLearning) {
                            // 记忆学习模式：清空暂停的分支记录
                            window.chessBoard.pausedBranches.clear();
                            // 同时清理localStorage中的记忆学习进度
                            clearMemoryLearningProgress();
                        } else {
                            // 背谱模式：清空当前的完成分支记录，准备重新加载
                            window.chessBoard.completedBranches.clear();
                        }
                        
                        // 重新加载用户进度，保留已完成的分支
                        await window.chessBoard.loadUserProgress();
                        
                        // 强制更新所有UI显示
                        window.chessBoard.updateProgress();
                        window.chessBoard.updateAccuracy();
                        
                        // 如果是记忆学习模式，更新分支名称显示
                        if (isMemoryLearning) {
                            window.chessBoard.updateBranchNamesDisplay();
                        }
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
            // 本地模式，清理本地状态
            if (isMemoryLearning) {
                // 记忆学习模式：清空暂停的分支记录并清理记忆学习进度
                window.chessBoard.clearAllMemoryLearningProgress();
                console.log('本地模式：已清理暂停的分支状态和记忆学习进度');
            } else {
                // 背谱模式：只清理未完成的分支记录
                console.log('本地模式：只清理未完成的分支状态');
            }
        }
        
        // 清理当前背诵状态
        window.chessBoard.computerUsedBranches.clear();
        
        // 重置错误计数
        window.chessBoard.errorCount = 0;
        window.chessBoard.branchErrorCounts.clear();
        
        // 重置正确率统计
        window.chessBoard.correctMoves = 0;
        window.chessBoard.totalMoves = 0;
        if (isMemoryLearning) {
            // 记忆学习模式：重置记忆学习的统计数据
            window.chessBoard.memoryCorrectMoves = 0;
            window.chessBoard.memoryTotalMoves = 0;
            // 注意：不自动清理本地存储的分支状态，保留学习进度
            // 只有在用户明确要求重置进度时才清理
            console.log('记忆学习模式：保留分支学习进度，只重置统计数据');
        }
        window.chessBoard.updateAccuracy();
        
        // 重置游戏状态（并重置正确率）
        window.chessBoard.resetPosition(true);
        
        // 更新UI（不清空PGN数据）
        updateUI();
        
        showNotification('进度已重置', 'success');
    });
    
    // 彻底重置所有学习进度（包括记忆学习）
    $('#hardResetAll').click(async function() {
        if (!confirm('⚠️ 危险操作确认\n\n确定要彻底重置所有学习进度吗？\n\n此操作将：\n• 删除所有背诵学习进度\n• 删除所有记忆学习进度\n• 无法恢复任何数据\n\n此操作不可撤销！')) {
            return;
        }
        
        // 停止所有学习模式
        window.chessBoard.stopStudy();
        
        // 如果有后端连接和PGN数据，调用后端彻底重置API
        if (window.chessAPI && window.chessAPI.isBackendAvailable && window.pgnParser?.metadata?.id) {
            try {
                const response = await fetch(`${window.chessAPI.baseURL}/progress/hard-reset-all`, {
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
                        showNotification('彻底重置成功！包括背诵学习和记忆学习的所有进度都已清理。', 'success');
                        
                        // 清理前端的记忆学习进度
                        window.chessBoard.clearAllMemoryLearningProgress();
                        
                        // 重新加载用户进度
                        await window.chessBoard.loadUserProgress();
                        
                        // 隐藏完成横幅
                        $('#completionBanner').hide();
                        
                        // 强制更新所有UI显示
                        window.chessBoard.updateProgress();
                        window.chessBoard.updateAccuracy();
                        
                        // 更新分支名称显示
                        if (window.chessBoard.isMemoryLearningMode) {
                            window.chessBoard.updateBranchNamesDisplay();
                        }
                    } else {
                        throw new Error(result.error || '彻底重置失败');
                    }
                } else {
                    throw new Error(`HTTP错误: ${response.status}`);
                }
            } catch (error) {
                console.error('彻底重置请求失败:', error);
                showNotification('网络错误，彻底重置失败: ' + error.message, 'error');
                return;
            }
        } else {
            // 本地模式，清理本地状态
            console.log('本地模式：清理所有学习进度');
            
            // 清理前端的记忆学习进度
            window.chessBoard.clearAllMemoryLearningProgress();
        }
        
        // 清理当前背诵状态
        window.chessBoard.computerUsedBranches.clear();
        
        // 重置错误计数
        window.chessBoard.errorCount = 0;
        window.chessBoard.branchErrorCounts.clear();
        
        // 重置正确率统计
        window.chessBoard.correctMoves = 0;
        window.chessBoard.totalMoves = 0;
        window.chessBoard.memoryCorrectMoves = 0;
        window.chessBoard.memoryTotalMoves = 0;
        
        // 隐藏完成横幅
        $('#completionBanner').hide();
        
        // 重置游戏状态
        window.chessBoard.resetPosition(true);
        
        // 更新UI
        updateUI();
        
        showNotification('所有学习进度已彻底重置', 'success');
    });
    



    // 监听颜色选择变化
    $('input[name="color"]').change(function() {
        const selectedColor = $(this).val();
        const previousColor = window.chessBoard.orientation;
        window.chessBoard.setOrientation(selectedColor);
        
        // 如果正在任何学习模式，需要重新开始
        if (window.chessBoard.isStudyMode) {
            window.chessBoard.startStudy();
        } else if (window.chessBoard.isSetupLearningMode) {
            window.chessBoard.startSetupLearning();
        } else if (window.chessBoard.isMemoryLearningMode) {
            // 记忆学习模式下，如果从白方切换到黑方，需要重置到初始局面
            if (previousColor === 'white' && selectedColor === 'black') {
                // 重置到初始局面，然后重新开始记忆学习
                window.chessBoard.resetPosition(true);
                setTimeout(() => {
                    window.chessBoard.startMemoryLearning();
                }, 100);
            } else {
                window.chessBoard.startMemoryLearning();
            }
        }
    });

// 根据PGN ID加载数据
async function loadPGNById(pgnId) {
    try {
        console.log('加载PGN ID:', pgnId);
        
        // 显示加载状态
        console.log('开始加载PGN数据...');
        
        // 调用API获取PGN数据
        const response = await fetch(`${window.chessAPI.baseURL}/pgn/${pgnId}`, {
            credentials: 'include'
        });
        
        if (!response.ok) {
            if (response.status === 404) {
                throw new Error('未找到指定的PGN文件');
            } else if (response.status === 401) {
                throw new Error('请先登录');
            } else {
                throw new Error(`加载失败: ${response.status}`);
            }
        }
        
        const pgnData = await response.json();
        
        // 验证数据
        if (!pgnData.branches || pgnData.branches.length === 0) {
            throw new Error('PGN文件中没有找到有效的分支数据');
        }
        
        // 存储解析结果
        window.pgnParser = pgnData;
        
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
        
        // 显示PGN文件名和分支数量
        const filename = pgnData.metadata?.filename || '未知文件';
        showNotification(`成功加载 ${filename}，共 ${pgnData.branches.length} 个分支！`, 'success');
        
        console.log('PGN数据加载成功:', {
            filename: filename,
            branches: pgnData.branches.length,
            games: pgnData.metadata?.total_games
        });
        
    } catch (error) {
        console.error('加载PGN数据失败:', error);
        
        let errorMessage = 'PGN文件加载失败！';
        if (error.message.includes('未找到')) {
            errorMessage = '未找到指定的PGN文件，可能已被删除';
        } else if (error.message.includes('登录')) {
            errorMessage = '请先登录后再尝试学习';
            // 跳转到登录页面
            setTimeout(() => {
                window.location.href = '/login.html';
            }, 2000);
        } else {
            errorMessage += ' 错误详情: ' + error.message;
        }
        
        showNotification(errorMessage, 'error');
        
        // 如果加载失败，可以跳转回进度页面
        setTimeout(() => {
            window.location.href = '/progress.html';
        }, 3000);
        
    } finally {
        // 加载完成
        console.log('PGN数据加载完成');
    }
}

function updateUI() {
        if (window.pgnParser && window.pgnParser.branches) {
            // 启用开始背谱按钮
            $('#startStudy').prop('disabled', false);
            // 启用摆棋学习按钮
            $('#setupLearning').prop('disabled', false);
            // 启用记忆学习按钮
            $('#memoryLearning').prop('disabled', false);
            
            // 更新进度显示
            window.chessBoard.updateProgress();
        } else {
            // 禁用开始背谱按钮
            $('#startStudy').prop('disabled', true);
            // 禁用摆棋学习按钮
            $('#setupLearning').prop('disabled', true);
            // 禁用记忆学习按钮
            $('#memoryLearning').prop('disabled', true);
            
            // 重置进度显示
            $('#totalBranches').text('0');
            $('#completedBranches').text('0');
            $('#progress').text('0%');
            $('#accuracy').text('0/0 (0%)').css('color', '#2196F3');
        }
        
        // 更新按钮状态
        updateButtonStates();
    }

    function updateButtonStates() {
        // 检查是否有任何学习模式在运行
        const isAnyLearningMode = window.chessBoard.isStudyMode || 
                                 window.chessBoard.isSetupLearningMode || 
                                 window.chessBoard.isMemoryLearningMode;
        
        if (isAnyLearningMode) {
            // 有学习模式在运行
            if (window.chessBoard.isStudyMode) {
                $('#startStudy').text('🛑 停止背谱').off('click').click(function() {
                    const success = window.chessBoard.stopStudy();
                    if (success) {
                        updateButtonStates();
                        showNotification('已停止背谱模式', 'success');
                    }
                });
            } else {
                $('#startStudy').text('🎯 开始背谱').prop('disabled', true);
            }
            
            if (window.chessBoard.isSetupLearningMode) {
                $('#setupLearning').text('🛑 停止摆棋学习').off('click').click(function() {
                    const success = window.chessBoard.stopStudy();
                    if (success) {
                        updateButtonStates();
                        showNotification('已停止摆棋学习模式', 'success');
                    }
                });
            } else {
                $('#setupLearning').text('📚 摆棋学习').prop('disabled', true);
            }
            
            if (window.chessBoard.isMemoryLearningMode) {
                $('#memoryLearning').text('🛑 停止记忆学习').off('click').click(function() {
                    const success = window.chessBoard.stopStudy();
                    if (success) {
                        updateButtonStates();
                        showNotification('已停止记忆学习模式', 'success');
                    }
                });
            } else {
                $('#memoryLearning').text('🧠 记忆学习').prop('disabled', true);
            }
            
            // 禁用其他学习模式按钮
            if (!window.chessBoard.isStudyMode) $('#startStudy').prop('disabled', true);
            if (!window.chessBoard.isSetupLearningMode) $('#setupLearning').prop('disabled', true);
            if (!window.chessBoard.isMemoryLearningMode) $('#memoryLearning').prop('disabled', true);
        } else {
            // 没有学习模式在运行
            $('#startStudy').text('🎯 开始背谱').off('click').click(async function() {
                const success = await window.chessBoard.startStudy();
                if (success) {
                    updateButtonStates();
                }
            });
            $('#setupLearning').text('📚 摆棋学习').off('click').click(async function() {
                const success = await window.chessBoard.startSetupLearning();
                if (success) {
                    updateButtonStates();
                }
            });
            $('#memoryLearning').text('🧠 记忆学习').off('click').click(async function() {
                const success = await window.chessBoard.startMemoryLearning();
                if (success) {
                    updateButtonStates();
                }
            });
            
            // 启用所有学习模式按钮
            $('#startStudy').prop('disabled', false);
            $('#setupLearning').prop('disabled', false);
            $('#memoryLearning').prop('disabled', false);
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