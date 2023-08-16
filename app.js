create = el => document.createElement(el);
createNS = el => document.createElementNS('http://www.w3.org/2000/svg', el);
$ = el => document.querySelector(el);
$$ = el => document.querySelectorAll(el);

function svg(tag, params) {
    const el = createNS(tag);
    for (const p in params) {
        el.setAttribute(p, params[p]);
    }
    return el;
}

class App {
    constructor(config) {
        this.W = config.width;
        this.H = config.width * config.page_ratio;
        this.line_height = 60;
        this.grid_ratio = config.grid_ratio;

        this.pages = [];
        this.curr_page = 0;
        this.page = undefined;
        this.history = [];
        this.history_cursor = null;
        this.canvas = $('#canvas');

        this.zoom = this.W * 1.06 / window.innerWidth;
        // this.zoom = 0.7;

        this.pan = new Victor(20, 20);

        this.is_mouse = true;

        this.events = new EventHandler(this);
    }

    add_page() {
        this.pages.push(new Page());
        this.open_page(this.pages.length - 1);
    }

    open_page(idx) {
        this.curr_page = idx;
        this.page = this.pages[this.curr_page];
        this.canvas.innerHTML = '';
        this.canvas.appendChild(this.page.el);
    }

    render() {
        this.pages[this.curr_page].render();
    }

    add_command(command) {
        if (this.history_cursor < this.history.length - 1) {
            this.history.splice(this.history_cursor + 1, this.history.length)
        }
        this.history.push(command);
        this.history_cursor++;
        render();
    }

    undo() {
        if (this.history_cursor > 0) {
            this.history[this.history_cursor].undo(this);
            this.history_cursor--;
        }
        render();
    }

    redo() {
        if (this.history_cursor < this.history.length - 2) {
            this.history_cursor++;
            this.history[this.history_cursor].redo(this);
        }
        render();
    }

    do_zoom(dir) {
        this.zoom += dir * 0.1;
        this.zoom = Math.max(0.2, Math.min(5, this.zoom));
        this.render();
    }

    do_pan(dir) {
        this.pan = this.pan.add(dir);
        this.render();
    }
}


