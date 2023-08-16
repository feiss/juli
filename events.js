
const ACTION_NONE = 'NONE';
const ACTION_DRAWING = 'DRAWING';
const ACTION_PANNING = 'PANNING';

class EventHandler {
    prev;

    constructor(app) {
        this.recognizer = new Recognizer();
        this.action = ACTION_NONE;

        app.canvas.addEventListener('pointerdown', this.on_pointer.bind(this));
        app.canvas.addEventListener('pointermove', this.on_pointer.bind(this));
        app.canvas.addEventListener('pointerup', this.on_pointer.bind(this));
        app.canvas.addEventListener('wheel', this.on_wheel.bind(this));
        app.canvas.addEventListener('contextmenu', this.on_context.bind(this));
        app.canvas.addEventListener('pointercancel', this.on_pointer.bind(this));
    }

    on_pointer(ev) {
        if (ev.target.tagName == 'A') return;

        if (ev.button == 2 || this.action == ACTION_PANNING) {
            return this.on_alt_pointer(ev);
        }
        // TODO: remove scrollleft and use only app.pan
        let x = (ev.clientX - app.pan.x + $('#canvas').scrollLeft) * app.zoom;
        let y = (ev.clientY - app.pan.y + $('#canvas').scrollTop) * app.zoom;
        switch (ev.type) {
            case 'pointerdown':
                app.is_mouse = ev.pointerType == "mouse";
                this.recognizer.restart();
                this.action = ACTION_DRAWING;
                const shape = app.page.add_stroke(5, '#215');
                shape.add_point(x, y);
                this.prev = new Victor(x, y);
                break;
            case 'pointermove':
                if (this.action != ACTION_DRAWING) return;
                const MIN_MOVEMENT = 8 * app.zoom;
                if (Math.abs(x - this.prev.x) > MIN_MOVEMENT || Math.abs(y - this.prev.y) > MIN_MOVEMENT) {
                    app.page.active_shape.add_point(x, y);
                    // if (DEBUG) c.strokeRect(x - 1, y - 1, 3, 3)
                    this.prev = new Victor(x, y);
                }
                break;
            case 'pointerup':
                if (this.action == ACTION_DRAWING) {
                    app.page.active_shape.add_point(x, y);
                    this.action = ACTION_NONE;
                    this.recognizer.recognize(app.page.active_shape);
                }
                break;
            case 'pointercancel':
                this.action = ACTION_NONE;
                this.recognizer.recognize(app.page.active_shape);
                break;
        }
    }

    on_wheel(ev) {
        ev.preventDefault();
        let delta = ev.deltaY;
        if (delta == 0) return;
        delta = ev.deltaY > 0 ? 1 : -1;
        app.do_zoom(delta);
    }

    on_context(ev) {
        ev.preventDefault();
    }

    on_alt_pointer(ev) {
        this.action = ACTION_PANNING;
        switch (ev.type) {
            case 'pointerdown':
                this.action = ACTION_PANNING;
                this.prev = new Victor(ev.clientX, ev.clientY);
                break;
            case 'pointermove':
                let pan = new Victor(ev.clientX, ev.clientY).subtract(this.prev);
                app.do_pan(pan);
                this.prev = new Victor(ev.clientX, ev.clientY);
                break;
            case 'pointerup':
                this.action = ACTION_NONE;
                break;
            case 'pointercancel':
                this.action = ACTION_NONE;
                break;

        }
    }
}

