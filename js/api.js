class ChessAPI {
    constructor() {
        this.baseURL = 'http://localhost:5000/api';
    }

    async uploadPGN(file) {
        try {
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
        } catch (error) {
            console.error('API调用错误:', error);
            throw error;
        }
    }

    async testConnection() {
        try {
            const response = await fetch(`${this.baseURL}/health`);
            return response.ok;
        } catch (error) {
            return false;
        }
    }

    async getTreeStructure() {
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
}

// 创建全局实例
window.chessAPI = new ChessAPI(); 