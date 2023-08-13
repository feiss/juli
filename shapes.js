class Stroke {
    constructor(thickness, color, w, h) {
        this.thickness = thickness;
        this.color = color;
        this.position = new Victor(0, 0);
        this.opacity = 1;
        this.coords = [];
        this.bounds = { x: 99999999, y: 99999999, x2: -99999999, y2: -99999999 };
        this.el = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        this.el.setAttribute('viewBox', '0 0 1500 1500');
    }

    add_point(x, y) {
        this.coords.push(new Victor(x, y));

        if (x < this.bounds.x) this.bounds.x = x;
        if (y < this.bounds.y) this.bounds.y = y;
        if (x > this.bounds.x2) this.bounds.x2 = x;
        if (y > this.bounds.y2) this.bounds.y2 = y;

        const thick = this.thickness;
        this.el.setAttribute('viewBox', `0 0 ${this.bounds.x2 + thick} ${this.bounds.y2 + thick}`);
        this.el.setAttribute('width', this.bounds.x2 + thick);
        this.el.setAttribute('height', this.bounds.y2 + thick);

        this.update();
    }

    translate(t) {
        this.position = this.position.add(t);
        this.update();
    }

    update() {
        let data = "M ";
        for (let i = 0; i < this.coords.length; i++) {
            data += this.coords[i].x + ',' + this.coords[i].y + ' ';
            if (i == 0) data += ' L ';
        }
        this.el.innerHTML = '';

        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('stroke', this.color);
        path.setAttribute('stroke-width', this.thickness);
        path.setAttribute('stroke-linecap', 'round');
        path.setAttribute('stroke-linejoin', 'round');

        path.setAttribute('opacity', this.opacity);
        path.setAttribute('fill', 'none');
        path.setAttribute('transform', `translate(${this.position.x}, ${this.position.y})`);
        path.setAttribute('d', data);

        this.el.appendChild(path);
    }
}


class Text {
    constructor(content, size, color, x, y) {
        this.position = new Victor(x, y);
        this.color = color;
        this.size = size;
        this.content = content;
        this.el = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        const s = this.size;
        this.el.setAttribute('viewBox', `0 0 ${x + s} ${y + s}`);
        this.el.setAttribute('width', x + s);
        this.el.setAttribute('height', y + s);
        this.update();
    }

    translate(t) {
        this.position = this.position.add(t);
        this.update();
    }

    update() {
        this.el.innerHTML = '';
        const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        text.setAttribute('x', this.position.x + this.size / 2 * 0.8);
        text.setAttribute('y', this.position.y + this.size / 2 * 1.1);
        text.setAttribute('fill', this.color);
        text.setAttribute('font-family', 'Patrick Hand, sans-serif');
        text.setAttribute('text-anchor', 'middle');
        text.setAttribute('dominant-baseline', 'middle');
        text.setAttribute('font-size', this.size);
        text.innerHTML = this.content;
        this.el.appendChild(text);
    }
}


class Grid {
    constructor(spacing, ratio) {
        this.el = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        this.spacing = spacing;
        this.ratio = ratio;
        this.position = new Victor(0, 0);
        this.el.setAttribute('viewBox', `0 0 ${W} ${H}`);
        this.el.setAttribute('width', W);
        this.el.setAttribute('height', H);
        this.update();
    }

    translate(t) {
        this.position = this.position.add(t);
        this.update();
    }

    update() {
        let data = '';
        for (let i = 0; i < H; i += this.spacing) {
            data += `M 0,${i} h ${W} `;
        }
        for (let i = 0; i < W; i += this.spacing * this.ratio) {
            data += `M ${i},0 v ${H} `;
        }

        this.el.innerHTML = '';
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('stroke', '#888');
        path.setAttribute('stroke-width', 1);
        path.setAttribute('fill', 'none');
        path.setAttribute('d', data);
        path.setAttribute('transform', `translate(${this.position.x}, ${this.position.y})`);
        this.el.appendChild(path);
    }
}