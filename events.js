
const ACTION_NONE = 'NONE';
const ACTION_DRAWING = 'DRAWING';
const ACTION_PANNING = 'PANNING';
const MIN_MOVEMENT = 8;

class EventHandler {
    prev;

    constructor(app) {
        this.recognizer = new Recognizer();

        app.canvas.addEventListener('pointerdown', this.on_pointer.bind(this));
        app.canvas.addEventListener('pointermove', this.on_pointer.bind(this));
        app.canvas.addEventListener('pointerup', this.on_pointer.bind(this));
        app.canvas.addEventListener('pointercancel', this.on_pointer.bind(this));
    }

    on_pointer(ev) {
        if (ev.target.tagName == 'A') return;
        // var rect = app.canvas.getBoundingClientRect();
        let x = (ev.clientX - app.pan.x) * app.zoom;
        let y = (ev.clientY - app.pan.y) * app.zoom;
        switch (ev.type) {
            case 'pointerdown':
                app.is_mouse = ev.pointerType == "mouse";
                this.recognizer.restart();
                app.action = ACTION_DRAWING;

                const shape = app.page.add_stroke(10, '#215');
                shape.add_point(x, y);
                this.prev = new Victor(x, y);
                break;
            case 'pointermove':
                if (app.action != ACTION_DRAWING) return;
                if (Math.abs(x - this.prev.x) > MIN_MOVEMENT || Math.abs(y - this.prev.y) > MIN_MOVEMENT) {
                    app.page.active_shape.add_point(x, y);
                    // if (DEBUG) c.strokeRect(x - 1, y - 1, 3, 3)
                    this.prev = new Victor(x, y);
                }
                break;
            case 'pointerup':
                if (app.action == ACTION_DRAWING) {
                    app.page.active_shape.add_point(x, y);
                    app.action = ACTION_NONE;
                    this.recognizer.recognize(app.page.active_shape);
                }
                break;
            case 'pointercancel':
                app.action = ACTION_NONE;
                this.recognizer.recognize(app.page.active_shape);
                break;
        }
    }
}

