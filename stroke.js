class Stroke {
    constructor(thickness, color) {
        this.thickness = thickness;
        this.color = color;
        this.position = new Victor(0, 0);
        this.opacity = 1;
        this.coords = [];
        this.bounds = { x: 99999999, y: 99999999, x2: -99999999, y2: -99999999 };
        this.el = svg('path', {
            'stroke': this.color,
            'stroke-width': this.thickness,
        });
    }

    #update() {
        let data = "M ";
        for (let i = 0; i < this.coords.length; i++) {
            data += this.coords[i].x + ',' + this.coords[i].y + ' ';
            if (i == 0) data += ' L ';
        }
        this.el.setAttribute('d', data);
    }

    add_point(x, y) {
        this.coords.push(new Victor(x, y));

        if (x < this.bounds.x) this.bounds.x = x;
        if (y < this.bounds.y) this.bounds.y = y;
        if (x > this.bounds.x2) this.bounds.x2 = x;
        if (y > this.bounds.y2) this.bounds.y2 = y;

        this.#update();
    }

    translate(t) {
        this.position = this.position.add(t);
        this.#update();
    }

}
