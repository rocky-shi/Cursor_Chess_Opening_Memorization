document.addEventListener('DOMContentLoaded', function() {
    // 为所有展开/收起按钮添加点击事件
    document.addEventListener('click', function(e) {
        if (e.target.classList.contains('expand-button')) {
            e.preventDefault();
            e.stopPropagation();
            
            const treeNode = e.target.closest('.tree-node');
            const childrenContainer = treeNode.querySelector(':scope > .children-container');
            
            if (childrenContainer) {
                // 切换展开/收起状态
                const isExpanded = e.target.classList.contains('expanded');
                
                if (isExpanded) {
                    // 收起
                    e.target.classList.remove('expanded');
                    e.target.textContent = '+';
                    childrenContainer.classList.remove('expanded');
                    childrenContainer.classList.add('collapsed');
                } else {
                    // 展开
                    e.target.classList.add('expanded');
                    e.target.textContent = '-';
                    childrenContainer.classList.remove('collapsed');
                    childrenContainer.classList.add('expanded');
                }
            }
        }
    });
}); 