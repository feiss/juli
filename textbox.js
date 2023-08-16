class TextBox {
    constructor(x, y, value, size, color) {
        this.position = new Victor(x, y);
        this.value = value;
        this.color = color;
        this.size = size;
        this.el = svg('text', {
            x: this.position.x + this.size / 2 * 0.8,
            y: this.position.y + this.size / 2 * 1.1,
            fill: this.color,
            stroke: 'none',
            'font-family': 'Patrick Hand, sans-serif',
            'text-anchor': 'middle',
            'dominant-baseline': 'middle',
            'font-size': this.size,
        });
        this.el.innerHTML = this.value;
    }

    #update() {
        this.el.setAttribute('x', this.position.x);
        this.el.setAttribute('y', this.position.y);
    }

    translate(t) {
        this.position = this.position.add(t);
        this.#update();
    }

}