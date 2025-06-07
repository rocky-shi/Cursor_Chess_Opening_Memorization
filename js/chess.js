class ChessBoard {
    constructor() {
        this.game = new Chess();
        this.board = null;
        this.orientation = 'white';
        this.currentBranch = null;
        this.completedBranches = new Set();
        this.turnIndicator = null;
        this.availableBranches = []; // 当前可用的分支
        this.isStudyMode = false; // 是否在背谱模式
        this.computerUsedBranches = new Set(); // 电脑已使用过的分支（用于白方第一步）
        this.errorCount = 0; // 错误计数器
        this.errorThreshold = 5; // 错误阈值，5次后提示正确走法
        this.correctMoves = 0; // 正确步数
        this.totalMoves = 0; // 总步数（已走步数）
    }

    init() {
        // 立即尝试初始化，如果失败则重试
        this.initializeBoard();
    }

    initializeBoard() {
        console.log('Initializing chess board...');
        
        const boardElement = document.getElementById('board');
        
        if (!boardElement) {
            console.error('Board element not found');
            // 如果元素还没准备好，稍后重试
            setTimeout(() => this.initializeBoard(), 200);
            return;
        }

        if (typeof Chessboard === 'undefined') {
            console.error('Chessboard.js library not loaded');
            // 如果库还没加载，稍后重试
            setTimeout(() => this.initializeBoard(), 200);
            return;
        }
        
        try {
            // 清除可能存在的旧棋盘
            $(boardElement).empty();
            
            // 保存this引用
            const self = this;
            
            // 配置棋盘
            const config = {
                draggable: true,
                position: 'start',
                onDragStart: function(source, piece, position, orientation) {
                    return self.onDragStart(source, piece, position, orientation);
                },
                onDrop: function(source, target, piece, newPos, oldPos, orientation) {
                    return self.onDrop(source, target);
                },
                onSnapEnd: function() {
                    return self.onSnapEnd();
                },
                pieceTheme: 'https://chessboardjs.com/img/chesspieces/wikipedia/{piece}.png',
                showNotation: true,
                sparePieces: false
            };
            
            console.log('Creating chessboard with config:', config);
            this.board = Chessboard('board', config);
            
            // 添加移动端触控支持，防止拖拽时页面滚动
            this.addTouchSupport();
            
            // 等待一小段时间确保棋盘完全渲染
            setTimeout(() => {
                if (this.board) {
                    console.log('Chessboard initialized successfully');
                    
                    // 设置初始位置
                    this.board.position('start');
                    
                    // 创建回合指示器
                    this.createTurnIndicator();
                    this.updateTurnIndicator();
                    
                    // 调整棋盘大小以确保正确显示
                    try {
                        this.board.resize();
                        console.log('Board resized successfully');
                    } catch (e) {
                        console.warn('Board resize failed:', e);
                    }
                } else {
                    console.error('Chessboard initialization failed, retrying...');
                    setTimeout(() => this.initializeBoard(), 500);
                }
            }, 100);
            
        } catch (error) {
            console.error('Error initializing chessboard:', error);
            setTimeout(() => this.initializeBoard(), 500);
        }
    }

    onDragStart(source, piece, position, orientation) {
        // 如果游戏结束，不允许移动
        if (this.game.game_over()) return false;
        
        // 如果不在背谱模式，允许自由拖拽
        if (!this.isStudyMode) {
            // 只允许拖拽当前方的棋子
            if ((this.game.turn() === 'w' && piece.search(/^b/) !== -1) ||
                (this.game.turn() === 'b' && piece.search(/^w/) !== -1)) {
                return false;
            }
            return true;
        }

        // 背谱模式下的拖拽限制
        const isWhiteTurn = this.game.turn() === 'w';
        const canMove = (this.orientation === 'white' && isWhiteTurn) ||
                        (this.orientation === 'black' && !isWhiteTurn);
        
        if (!canMove) return false;
        
        // 只允许拖拽当前方的棋子
        if ((this.game.turn() === 'w' && piece.search(/^b/) !== -1) ||
            (this.game.turn() === 'b' && piece.search(/^w/) !== -1)) {
            return false;
        }
        
        return true;
    }

    onDrop(source, target) {
        console.log(`Move attempted: ${source} to ${target}`);
        
        // 尝试移动
        const move = this.game.move({
            from: source,
            to: target,
            promotion: 'q' // 默认升为皇后
        });

        // 如果移动不合法
        if (move === null) {
            console.log('Illegal move');
            return 'snapback';
        }

        console.log('Legal move:', move);

        // 如果不在背谱模式，允许自由下棋
        if (!this.isStudyMode) {
            this.updateMoveHistory(move);
            this.updateTurnIndicator();
            return;
        }

        // 背谱模式下检查移动是否正确
        const matchingBranch = this.findMatchingBranch(move);
        
        if (!matchingBranch) {
            // 没有匹配的分支，走错了
            console.log('No matching branch found');
            this.game.undo(); // 撤销移动
            
            // 统计错误步数：已走步数+1，正确步数不变
            this.totalMoves++;
            this.updateAccuracy();
            
            this.showError();
            return 'snapback';
        }

        console.log('Found matching branch');

        // 走对了，重置错误计数器
        this.errorCount = 0;
        
        // 统计正确步数：正确步数+1，已走步数+1
        this.correctMoves++;
        this.totalMoves++;
        this.updateAccuracy();

        // 更新当前分支
        this.currentBranch = matchingBranch;
        this.updateAvailableBranches();

        // 更新界面
        this.updateMoveHistory(move);
        this.updateTurnIndicator();
        
        // 检查是否完成当前分支
        if (this.isCurrentBranchCompleted()) {
            this.onBranchCompleted();
            return;
        }

        // 执行电脑走棋
        setTimeout(() => this.makeComputerMove(), 500);
    }

    onSnapEnd() {
        // 确保棋盘位置与游戏状态同步
        if (this.board) {
            this.board.position(this.game.fen());
        }
    }

    findMatchingBranch(move) {
        const currentHistory = this.game.history();
        const moveIndex = currentHistory.length - 1;
        
        // 在可用分支中查找匹配的分支
        for (const branch of this.availableBranches) {
            if (branch.moves[moveIndex] === move.san) {
                return branch;
            }
        }
        
        return null;
    }

    updateAvailableBranches() {
        if (!window.pgnParser || !window.pgnParser.branches) {
            this.availableBranches = [];
            return;
        }

        const currentHistory = this.game.history();
        
        // 筛选出与当前历史匹配且未完成的分支
        this.availableBranches = window.pgnParser.branches.filter(branch => {
            // 跳过已完成的分支
            if (this.completedBranches.has(branch.id)) {
                return false;
            }
            
            // 检查历史是否匹配
            for (let i = 0; i < currentHistory.length; i++) {
                if (i >= branch.moves.length || branch.moves[i] !== currentHistory[i]) {
                    return false;
                }
            }
            
            return true;
        });
    }

    makeComputerMove() {
        if (!this.currentBranch) return;
        
        const history = this.game.history();
        const nextMove = this.currentBranch.moves[history.length];
        
        if (nextMove) {
            const move = this.game.move(nextMove);
            if (move) {
                if (this.board) {
                    this.board.position(this.game.fen()); // 更新棋盘位置
                }
                this.updateMoveHistory(move);
                this.updateTurnIndicator();
                
                // 更新可用分支
                this.updateAvailableBranches();
                
                // 检查电脑走完后是否完成分支
                if (this.isCurrentBranchCompleted()) {
                    this.onBranchCompleted();
                    return;
                }
            }
        }
    }

    createTurnIndicator() {
        this.turnIndicator = document.getElementById('turnIndicator');
        if (!this.turnIndicator) {
            this.turnIndicator = document.createElement('div');
            this.turnIndicator.id = 'turnIndicator';
            this.turnIndicator.className = 'turn-indicator';
            const boardContainer = document.querySelector('.board-container');
            if (boardContainer) {
                boardContainer.appendChild(this.turnIndicator);
            }
        }
    }

    updateTurnIndicator() {
        if (!this.turnIndicator) return;
        
        const isWhiteTurn = this.game.turn() === 'w';
        this.turnIndicator.className = `turn-indicator ${isWhiteTurn ? 'turn-white' : 'turn-black'}`;
    }

    setOrientation(color) {
        this.orientation = color;
        if (this.board) {
            this.board.orientation(color);
        }
        this.updateTurnIndicator();
    }

    updateMoveHistory(move) {
        const history = this.game.history();
        const moveNumber = Math.floor((history.length + 1) / 2);
        const isWhiteMove = history.length % 2 === 1;
        
        // 如果是白方走棋，创建新的行棋记录
        if (isWhiteMove) {
            $('#moveHistory').append(
                `<span class="move-pair" data-move="${moveNumber}">` +
                `${moveNumber}. ${move.san}</span>`
            );
        } else {
            // 如果是黑方走棋，找到当前回合的span并添加黑方走法
            const currentMove = $(`#moveHistory .move-pair[data-move="${moveNumber}"]`);
            if (currentMove.length) {
                currentMove.append(` ${move.san} `);
            } else {
                // 如果找不到当前回合的span（比如开局黑方），创建新的
                $('#moveHistory').append(
                    `<span class="move-pair" data-move="${moveNumber}">` +
                    `${moveNumber}. ... ${move.san}</span>`
                );
            }
        }
        
        $('#moveHistory').scrollTop($('#moveHistory')[0].scrollHeight);
    }

    showError() {
        this.errorCount++;
        
        let errorMessage = `您背错了！这是第${this.errorCount}次错误。`;
        
        // 只有在错误次数达到阈值时才显示正确走法
        if (this.errorCount >= this.errorThreshold) {
            const possibleMoves = this.getPossibleMoves();
            if (possibleMoves.length > 0) {
                errorMessage += ` 正确走法有: ${possibleMoves.join(', ')}`;
            }
            // 重置错误计数器
            this.errorCount = 0;
        } else {
            errorMessage += ` 再错${this.errorThreshold - this.errorCount}次将提示正确走法。`;
        }
        
        $('#errorToast').text(errorMessage).fadeIn().delay(3000).fadeOut();
    }

    getPossibleMoves() {
        const currentHistory = this.game.history();
        const moveIndex = currentHistory.length;
        const possibleMoves = new Set();
        
        // 收集所有可用分支在当前位置的可能走法
        for (const branch of this.availableBranches) {
            if (moveIndex < branch.moves.length) {
                possibleMoves.add(branch.moves[moveIndex]);
            }
        }
        
        return Array.from(possibleMoves);
    }

    resetPosition(resetAccuracy = false) {
        this.game.reset();
        if (this.board) {
            this.board.position('start');
        }
        $('#moveHistory').empty();
        this.updateTurnIndicator();
        this.currentBranch = null;
        this.errorCount = 0; // 重置错误计数器
        
        if (this.isStudyMode) {
            // 只有在明确要求时才重置正确率统计
            if (resetAccuracy) {
                this.correctMoves = 0;
                this.totalMoves = 0;
                this.updateAccuracy();
            }
            
            this.updateAvailableBranches();
            
            // 如果用户选择黑方，电脑先走
            if (this.orientation === 'black' && this.availableBranches.length > 0) {
                setTimeout(() => this.makeFirstComputerMove(), 500);
            }
        }
    }

    makeFirstComputerMove() {
        if (!this.isStudyMode || this.availableBranches.length === 0) return;
        
        // 获取第一手可能的走法和对应的分支
        const firstMoveOptions = new Map(); // 走法 -> 对应的分支数组
        
        for (const branch of this.availableBranches) {
            if (branch.moves.length > 0) {
                const firstMove = branch.moves[0];
                if (!firstMoveOptions.has(firstMove)) {
                    firstMoveOptions.set(firstMove, []);
                }
                firstMoveOptions.get(firstMove).push(branch);
            }
        }
        
        // 筛选出未使用过的走法
        const unusedMoves = [];
        for (const [move, branches] of firstMoveOptions) {
            // 检查这个走法对应的分支是否都被使用过了
            const hasUnusedBranch = branches.some(branch => !this.computerUsedBranches.has(branch.id));
            if (hasUnusedBranch) {
                unusedMoves.push(move);
            }
        }
        
        // 如果所有分支都用过了，重置已使用记录
        if (unusedMoves.length === 0) {
            this.computerUsedBranches.clear();
            // 重新获取所有第一手走法
            for (const [move] of firstMoveOptions) {
                unusedMoves.push(move);
            }
        }
        
        // 随机选择一个未使用的走法
        if (unusedMoves.length > 0) {
            const randomMove = unusedMoves[Math.floor(Math.random() * unusedMoves.length)];
            const correspondingBranches = firstMoveOptions.get(randomMove);
            
            // 从对应分支中选择一个未使用的分支（如果有的话）
            let selectedBranch = null;
            for (const branch of correspondingBranches) {
                if (!this.computerUsedBranches.has(branch.id)) {
                    selectedBranch = branch;
                    break;
                }
            }
            
            // 如果没找到未使用的分支，就选第一个
            if (!selectedBranch) {
                selectedBranch = correspondingBranches[0];
            }
            
            // 标记这个分支为已使用
            this.computerUsedBranches.add(selectedBranch.id);
            
            // 执行走棋
            const move = this.game.move(randomMove);
            if (move) {
                if (this.board) {
                    this.board.position(this.game.fen()); // 更新棋盘位置
                }
                this.updateMoveHistory(move);
                this.updateTurnIndicator();
                this.updateAvailableBranches();
                
                // 显示提示信息
                const message = `电脑选择了走法: ${randomMove}。现在轮到您走棋了！`;
                $('#errorToast').text(message).css('background', '#17a2b8').fadeIn().delay(2000).fadeOut().promise().done(() => {
                    $('#errorToast').css('background', '#ff4444');
                });
            }
        }
    }

    updateProgress() {
        // 直接使用branches数组的长度，因为window.pgnParser现在是后端响应对象
        const total = window.pgnParser && window.pgnParser.branches ? window.pgnParser.branches.length : 0;
        const completed = this.completedBranches.size;
        const progress = total > 0 ? Math.round((completed / total) * 100) : 0;
        
        $('#totalBranches').text(total);
        $('#completedBranches').text(completed);
        $('#progress').text(`${progress}%`);
        
        if (progress === 100 && total > 0) {
            // 计算最终正确率
            const finalAccuracy = this.totalMoves > 0 ? Math.round((this.correctMoves / this.totalMoves) * 100) : 0;
            
            // 更新完成横幅显示最终正确率
            $('#completionBanner').html(`🎉 恭喜！您已背完所有分支！最终正确率：<span style="font-weight: bold;">${finalAccuracy}%</span>`);
            $('#completionBanner').show();
        }
    }

    updateAccuracy() {
        // 计算正确率
        const accuracy = this.totalMoves > 0 ? Math.round((this.correctMoves / this.totalMoves) * 100) : 0;
        
        // 更新UI显示
        $('#accuracy').text(`${accuracy}%`);
        
        // 根据正确率设置不同的颜色
        const accuracyElement = $('#accuracy');
        if (accuracy >= 90) {
            accuracyElement.css('color', '#4CAF50'); // 绿色 - 优秀
        } else if (accuracy >= 70) {
            accuracyElement.css('color', '#FF9800'); // 橙色 - 良好
        } else {
            accuracyElement.css('color', '#f44336'); // 红色 - 需要改进
        }
        
        console.log(`正确率更新: ${this.correctMoves}/${this.totalMoves} = ${accuracy}%`);
    }

    isCurrentBranchCompleted() {
        if (!this.currentBranch) return false;
        return this.game.history().length === this.currentBranch.moves.length;
    }

    onBranchCompleted() {
        // 标记当前分支为已完成
        this.completedBranches.add(this.currentBranch.id);
        this.updateProgress();
        
        // 显示分支完成模态框
        this.showBranchCompletedModal();
        
        // 2秒后自动回到初始位置（不重置正确率）
        setTimeout(() => {
            this.resetPosition(false); // 不重置正确率，保持累积
        }, 2000);
    }

    showBranchCompletedModal() {
        // 计算当前正确率
        const accuracy = this.totalMoves > 0 ? Math.round((this.correctMoves / this.totalMoves) * 100) : 0;
        
        const modal = $(`
            <div class="modal-overlay">
                <div class="modal-content">
                    <h3>🎉 分支背诵完成！</h3>
                    <p>恭喜您成功背完了当前分支！</p>
                    <p>当前累积正确率：<span style="color: #4CAF50; font-weight: bold;">${accuracy}%</span></p>
                    <p>即将自动回到初始位置...</p>
                </div>
            </div>
        `);
        
        $('body').append(modal);
        
        // 2秒后自动移除模态框
        setTimeout(() => {
            modal.remove();
        }, 2000);
    }

    startStudy() {
        // 检查是否有PGN数据
        if (!window.pgnParser || !window.pgnParser.branches || window.pgnParser.branches.length === 0) {
            const message = '请先加载PGN文件！';
            $('#errorToast').text(message).css('background', '#dc3545').fadeIn().delay(3000).fadeOut().promise().done(() => {
                $('#errorToast').css('background', '#ff4444');
            });
            return false;
        }

        this.isStudyMode = true;
        
        // 重置正确率统计
        this.correctMoves = 0;
        this.totalMoves = 0;
        this.updateAccuracy();
        
        this.resetPosition(true); // 重置位置并重置正确率
        this.errorCount = 0; // 重置错误计数器
        
        // 再次检查是否有可用分支
        if (this.availableBranches.length === 0) {
            const message = '没有可用的分支进行背谱！可能所有分支都已完成。';
            $('#errorToast').text(message).css('background', '#ffc107').fadeIn().delay(3000).fadeOut().promise().done(() => {
                $('#errorToast').css('background', '#ff4444');
            });
            this.isStudyMode = false;
            return false;
        }
        
        // 显示提示信息
        if (this.orientation === 'black') {
            // 黑方视角，电脑会先走
            const message = `背谱模式已开启！电脑将随机选择一个分支走出白方第一步，然后您进行背谱练习。`;
            $('#errorToast').text(message).css('background', '#28a745').fadeIn().delay(3000).fadeOut().promise().done(() => {
                $('#errorToast').css('background', '#ff4444');
            });
        } else {
            // 白方视角，显示可能的走法
            const possibleMoves = this.getPossibleMoves();
            if (possibleMoves.length > 0) {
                const message = `背谱模式已开启！根据您的走棋自动匹配分支。当前可能的走法: ${possibleMoves.join(', ')}`;
                $('#errorToast').text(message).css('background', '#28a745').fadeIn().delay(3000).fadeOut().promise().done(() => {
                    $('#errorToast').css('background', '#ff4444');
                });
            }
        }
        
        return true;
    }

    stopStudy() {
        this.isStudyMode = false;
        this.currentBranch = null;
        this.availableBranches = [];
        this.computerUsedBranches.clear(); // 清空电脑已使用的分支记录
        this.errorCount = 0; // 重置错误计数器
        
        // 重置正确率统计
        this.correctMoves = 0;
        this.totalMoves = 0;
        this.updateAccuracy();
        
        return true;
    }

    addTouchSupport() {
        const boardElement = document.getElementById('board');
        if (!boardElement) return;

        let isDragging = false;
        let touchStartY = 0;
        let lastTouchTarget = null;

        // 检查元素是否是棋子
        const isPieceElement = (element) => {
            if (!element) return false;
            
            // 检查多种可能的棋子标识
            return element.classList.contains('piece-417db') ||
                   element.closest('.piece-417db') ||
                   element.classList.toString().includes('piece') ||
                   (element.style && element.style.backgroundImage && element.style.backgroundImage.includes('.png')) ||
                   element.getAttribute('data-piece') ||
                   (element.className && element.className.includes('piece'));
        };

        // 处理触摸开始事件
        boardElement.addEventListener('touchstart', (e) => {
            const target = e.target;
            lastTouchTarget = target;
            
            // 检查是否触摸在棋子上
            if (isPieceElement(target)) {
                isDragging = true;
                touchStartY = e.touches[0].clientY;
                console.log('开始拖拽棋子，阻止页面滚动');
                
                // 立即阻止滚动
                e.preventDefault();
            }
        }, { passive: false });

        // 处理触摸移动事件
        boardElement.addEventListener('touchmove', (e) => {
            // 如果正在拖拽棋子，或者触摸目标是棋子，都阻止滚动
            if (isDragging || isPieceElement(e.target) || isPieceElement(lastTouchTarget)) {
                e.preventDefault();
                e.stopPropagation();
                
                // 更新拖拽状态
                if (!isDragging && isPieceElement(e.target)) {
                    isDragging = true;
                    touchStartY = e.touches[0].clientY;
                    console.log('检测到棋子拖拽，阻止页面滚动');
                }
            }
        }, { passive: false });

        // 处理触摸结束事件
        boardElement.addEventListener('touchend', (e) => {
            if (isDragging) {
                isDragging = false;
                lastTouchTarget = null;
                console.log('结束拖拽棋子，恢复页面滚动');
            }
        }, { passive: true });

        // 处理触摸取消事件
        boardElement.addEventListener('touchcancel', (e) => {
            if (isDragging) {
                isDragging = false;
                lastTouchTarget = null;
                console.log('拖拽被取消，恢复页面滚动');
            }
        }, { passive: true });

        // 为整个棋盘容器添加额外的保护
        const boardContainer = boardElement.closest('.board-container');
        if (boardContainer) {
            // 使用事件委托处理动态生成的棋子
            boardContainer.addEventListener('touchstart', (e) => {
                if (isPieceElement(e.target)) {
                    e.preventDefault();
                }
            }, { passive: false });

            boardContainer.addEventListener('touchmove', (e) => {
                if (isDragging || isPieceElement(e.target)) {
                    e.preventDefault();
                    e.stopPropagation();
                }
            }, { passive: false });
        }

        // 为document添加全局监听，作为最后的防护
        document.addEventListener('touchmove', (e) => {
            if (isDragging) {
                e.preventDefault();
            }
        }, { passive: false });

        console.log('移动端触控支持已添加 - 拖拽棋子时将阻止页面滚动');
    }
} 