$(document).ready(function() {
    console.log('Document ready');
    
    // 创建国际象棋实例
    window.chessBoard = new ChessBoard();
    
    // 隐藏加载屏幕并显示主内容
    setTimeout(() => {
        $('#loadingScreen').fadeOut(300, () => {
            $('#mainContainer').fadeIn(300, () => {
                console.log('Main container visible, initializing chess board...');
                // 在主容器显示后初始化棋盘
                window.chessBoard.init();
                
                // 如果有保存的PGN数据，自动加载
                if (window.pgnParser && window.pgnParser.branches && window.pgnParser.branches.length > 0) {
                    updateUI();
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
            // 显示加载状态
            $('#loadPgn').prop('disabled', true).text('解析中...');
            
            // 使用API类上传文件
            window.chessAPI.uploadPGN(file)
                .then(function(response) {
                    console.log('PGN parsed successfully:', response);
                    
                    // 存储解析结果
                    window.pgnParser = response;
                    
                    // 重置棋盘状态
                    window.chessBoard.completedBranches.clear();
                    window.chessBoard.computerUsedBranches.clear();
                    
                    // 更新UI
                    updateUI();
                    
                    // 显示成功消息
                    showNotification(`成功加载 ${response.branches.length} 个分支！`, 'success');
                })
                .catch(function(error) {
                    console.error('PGN parsing failed:', error);
                    showNotification('PGN文件解析失败，请检查文件格式！', 'error');
                })
                .finally(function() {
                    // 恢复按钮状态
                    $('#loadPgn').prop('disabled', false).text('📁 加载对局');
                });
        }
    });

    // 开始背谱
    $('#startStudy').click(function() {
        const success = window.chessBoard.startStudy();
        if (success) {
            updateButtonStates(true);
        }
    });

    // 重置位置
    $('#resetPosition').click(function() {
        window.chessBoard.resetPosition();
    });

    // 完全重置
    $('#resetAll').click(function() {
        // 停止背谱模式
        window.chessBoard.stopStudy();
        
        // 重置游戏状态
        window.chessBoard.resetPosition();
        
        // 清理背诵状态，但保留PGN数据
        window.chessBoard.completedBranches.clear();
        window.chessBoard.computerUsedBranches.clear();
        
        // 更新UI（不清空PGN数据）
        updateUI();
        
        // 隐藏完成横幅
        $('#completionBanner').hide();
        
        showNotification('已重置背诵状态，棋谱数据保留', 'success');
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
            $('#startStudy').text('🎯 开始背谱').off('click').click(function() {
                const success = window.chessBoard.startStudy();
                if (success) {
                    updateButtonStates(true);
                }
            });
        }
    }

    function showNotification(message, type = 'success') {
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