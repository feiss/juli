
class Page {

    constructor() {
        this.el = this.#render_page();
        this.drawings = [];
        this.cells = [];
        this.active_shape = null;

        this.grid = this.#render_grid();
        this.el.appendChild(this.grid);
    }

    #render_page() {
        const el = svg('svg', {
            viewBox: `0 0 ${app.W} ${app.H}`,
            width: app.W / app.zoom,
            height: app.H / app.zoom,
            stroke: '#888',
            'stroke-width': 1,
            fill: 'none',
            'stroke-linecap': 'round',
            'stroke-linejoin': 'round',

        });
        el.classList.add('page');
        return el;
    }

    #render_grid() {
        const line_height = app.line_height;
        const ratio = app.grid_ratio;
        this.position = new Victor(0, 0);
        let data = '';
        for (let i = line_height; i < app.H; i += line_height) {
            data += `M 0,${i} h ${app.W} `;
        }
        for (let i = line_height * ratio; i < app.W; i += line_height * ratio) {
            data += `M ${i},0 v ${app.H} `;
        }

        return svg('path', { d: data, stroke: '#abc' })
    }

    render() {
        this.el.style.width = (app.W / app.zoom) + 'px';
        this.el.style.height = (app.H / app.zoom) + 'px';
        this.el.style.left = app.pan.x + 'px';
        this.el.style.top = app.pan.y + 'px';
    }

    add_stroke(thickness, color) {
        const stroke = new Stroke(thickness, color);
        this.active_shape = stroke;
        this.el.appendChild(stroke.el);
        return stroke;
    }

    add_text(x, y, value, size, color) {
        const textbox = new TextBox(x, y, value, size, color);
        this.drawings.push(textbox);
        this.active_shape = textbox;
        console.log(textbox.el);
        this.el.appendChild(textbox.el);
        return textbox;
    }

    set_cell(x, y, value, stroke) {
        if (this.cells[x] === undefined) this.cells[x] = [];
        else if (this.cells[x][y] !== undefined) {
            // already some data, remove it
            const stroke = this.cells[x][y].stroke;
            stroke.el.parentNode.removeChild(stroke.el);
        }
        this.cells[x][y] = { value, stroke };
    }

    clear_cell(x, y) {
        if (this.cells[x] !== undefined && this.cells[x][y] !== undefined) {
            const stroke = this.cells[x][y].stroke;
            stroke.el.parentNode.removeChild(stroke.el);
            delete this.cells[x][y];
        }

    }
}


