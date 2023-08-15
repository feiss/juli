
class Page {

    constructor() {
        this.el = this.#render_page();
        this.strokes = [];
        this.drawings = [];

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
        const line_height = 100;
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
        const stroke = new Stroke(thickness, color)
        this.strokes.push(stroke);
        this.active_shape = stroke;
        this.el.appendChild(stroke.el);
        return stroke;
    }
}


