/*
Pagination.js - Feature-rich, reusable pagination for vanilla JS

Usage:
const paginator = new Pagination({
    container: document.getElementById('my-pagination'),
    totalItems: 120,
    currentPage: 1,
    pageSize: 10,
    onPageChange: (page) => {
        // Load data for the new page
    },
    maxPageButtons: 5 // Optional: how many numbered buttons to show (default 5)
});

// To update:
paginator.update({ totalItems: 200, currentPage: 2 });
*/

class Pagination {
    constructor({ container, totalItems, currentPage = 1, pageSize = 10, onPageChange, maxPageButtons = 5 }) {
        this.container = container;
        this.totalItems = totalItems;
        this.currentPage = currentPage;
        this.pageSize = pageSize;
        this.onPageChange = onPageChange;
        this.maxPageButtons = maxPageButtons;
        this.totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
        this._render();
    }

    update({ totalItems, currentPage, pageSize }) {
        if (totalItems !== undefined) this.totalItems = totalItems;
        if (currentPage !== undefined) this.currentPage = currentPage;
        if (pageSize !== undefined) this.pageSize = pageSize;
        this.totalPages = Math.max(1, Math.ceil(this.totalItems / this.pageSize));
        this._render();
    }

    _render() {
        if (!this.container) return;
        this.container.innerHTML = '';
        this.container.classList.add('pagination-container');
        this.container.setAttribute('role', 'navigation');
        this.container.setAttribute('aria-label', 'Pagination Navigation');

        // First button
        this._addButton('«', 1, this.currentPage === 1, 'First Page');
        // Prev button
        this._addButton('‹', this.currentPage - 1, this.currentPage === 1, 'Previous Page');

        // Page numbers with ellipsis
        const { start, end } = this._getPageRange();
        if (start > 1) {
            this._addButton('1', 1, false, 'Page 1');
            if (start > 2) this._addEllipsis();
        }
        for (let i = start; i <= end; i++) {
            this._addButton(i, i, i === this.currentPage, `Page ${i}`);
        }
        if (end < this.totalPages) {
            if (end < this.totalPages - 1) this._addEllipsis();
            this._addButton(this.totalPages, this.totalPages, false, `Page ${this.totalPages}`);
        }

        // Next button
        this._addButton('›', this.currentPage + 1, this.currentPage === this.totalPages, 'Next Page');
        // Last button
        this._addButton('»', this.totalPages, this.currentPage === this.totalPages, 'Last Page');

        // Keyboard accessibility
        this._setupKeyboardNav();
    }

    _getPageRange() {
        let start = Math.max(1, this.currentPage - Math.floor(this.maxPageButtons / 2));
        let end = start + this.maxPageButtons - 1;
        if (end > this.totalPages) {
            end = this.totalPages;
            start = Math.max(1, end - this.maxPageButtons + 1);
        }
        return { start, end };
    }

    _addButton(label, page, disabled, ariaLabel) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'pagination-btn';
        btn.textContent = label;
        btn.setAttribute('aria-label', ariaLabel);
        btn.setAttribute('tabindex', '0');
        if (disabled) {
            btn.disabled = true;
            btn.setAttribute('aria-current', 'page');
        }
        if (page === this.currentPage && !isNaN(page)) {
            btn.classList.add('active');
        }
        btn.addEventListener('click', () => {
            if (!disabled && page !== this.currentPage) {
                this.currentPage = page;
                this._render();
                if (typeof this.onPageChange === 'function') {
                    this.onPageChange(page);
                }
            }
        });
        this.container.appendChild(btn);
    }

    _addEllipsis() {
        const span = document.createElement('span');
        span.className = 'pagination-ellipsis';
        span.textContent = '…';
        span.setAttribute('aria-hidden', 'true');
        this.container.appendChild(span);
    }

    _setupKeyboardNav() {
        const buttons = Array.from(this.container.querySelectorAll('.pagination-btn'));
        buttons.forEach((btn, idx) => {
            btn.addEventListener('keydown', (e) => {
                if (e.key === 'ArrowRight') {
                    if (idx < buttons.length - 1) buttons[idx + 1].focus();
                } else if (e.key === 'ArrowLeft') {
                    if (idx > 0) buttons[idx - 1].focus();
                } else if (e.key === 'Home') {
                    buttons[0].focus();
                } else if (e.key === 'End') {
                    buttons[buttons.length - 1].focus();
                }
            });
        });
    }
}

// Optional: Modern CSS for pagination (add to your main CSS or inject as needed)
if (!document.getElementById('pagination-css')) {
    const style = document.createElement('style');
    style.id = 'pagination-css';
    style.textContent = `
.pagination-container {
  display: flex;
  gap: 0.25rem;
  align-items: center;
  justify-content: center;
  margin: 1rem 0;
  flex-wrap: wrap;
}
.pagination-btn {
  background: #fff;
  border: 1px solid #ccc;
  color: #333;
  padding: 0.4em 0.8em;
  margin: 0 0.1em;
  border-radius: 4px;
  cursor: pointer;
  font-size: 1em;
  transition: background 0.2s, color 0.2s, border 0.2s;
}
.pagination-btn.active,
.pagination-btn:focus {
  background: #2196f3;
  color: #fff;
  border-color: #2196f3;
  outline: none;
}
.pagination-btn[disabled] {
  background: #eee;
  color: #aaa;
  border-color: #eee;
  cursor: not-allowed;
}
.pagination-ellipsis {
  padding: 0 0.5em;
  color: #888;
  font-size: 1.2em;
  user-select: none;
}
`;
    document.head.appendChild(style);
}

// Export for use in other scripts (if using modules)
// export default Pagination; 