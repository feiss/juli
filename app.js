
class App {
    constructor() {
        this.pages = [new Page()];
        this.curr_page = 0;
        this.history = [];
        this.history_cursor = null;

        this.canvas = $('#canvas');
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
}