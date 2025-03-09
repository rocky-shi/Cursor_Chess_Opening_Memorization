class ChessApp {
    constructor() {
        this.chessBoard = new ChessBoard();
        this.pgnParser = new PGNParser();
        window.pgnParser = this.pgnParser; // 为了让ChessBoard能访问到
    }

    init() {
        this.chessBoard.init();
        this.setupEventListeners();
    }

    setupEventListeners() {
        // 加载PGN文件
        $('#loadPgn').click(() => {
            $('#pgnInput').click();
        });

        $('#pgnInput').change(async (e) => {
            const file = e.target.files[0];
            if (!file) return;

            const success = await this.pgnParser.loadPGN(file);
            if (success) {
                this.chessBoard.resetPosition();
                this.chessBoard.updateProgress();
                $('#startStudy').prop('disabled', false);
                if (this.chessBoard.debugMode) {
                    this.chessBoard.updateDebugDisplay();
                }
            } else {
                alert('无法解析PGN文件，请检查文件格式');
            }
        });

        // 开始背谱
        $('#startStudy').click(() => {
            const branch = this.pgnParser.getNextUncompletedBranch(this.chessBoard.completedBranches);
            if (!branch) {
                alert('所有分支已完成！');
                return;
            }

            this.chessBoard.currentBranch = branch;
            this.chessBoard.resetPosition();
            if (this.chessBoard.debugMode) {
                this.chessBoard.updateDebugDisplay();
            }

            // 如果用户选择黑方，电脑先走
            if (this.chessBoard.orientation === 'black') {
                this.chessBoard.makeComputerMove();
            }
        });

        // 重置位置
        $('#resetPosition').click(() => {
            this.chessBoard.resetPosition();
        });

        // 完全重置
        $('#resetAll').click(() => {
            this.chessBoard.resetPosition();
            this.chessBoard.completedBranches.clear();
            this.chessBoard.currentBranch = null;
            this.chessBoard.updateProgress();
            $('#completionBanner').hide();
            $('#moveHistory').empty();
            if (this.chessBoard.debugMode) {
                this.chessBoard.updateDebugDisplay();
            }
        });

        // 选择颜色
        $('input[name="color"]').change((e) => {
            const color = e.target.value;
            this.chessBoard.setOrientation(color);
            this.chessBoard.resetPosition();
        });

        // 调试模式切换
        $('#toggleDebug').click(() => {
            this.chessBoard.toggleDebugMode();
        });
    }
}

// 当页面加载完成后初始化应用
$(document).ready(() => {
    const app = new ChessApp();
    app.init();
}); 