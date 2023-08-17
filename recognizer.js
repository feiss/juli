
const WAIT_NEXT_STROKE = 700;

class Recognizer {
    waiting_next_stroke = false;
    shape = null;
    bb;
    prev_shape;
    prev_bb;
    prev_angles;
    prev_result;
    prev_cell;

    constructor() {
        this.restart()
    }

    restart() {
        if (!this.waiting_next_stroke) {
            this.bb = {
                x: 999999,
                y: 999999,
                x2: 0,
                y2: 0,
            };
        }
        this.prev_bb = structuredClone(this.bb);
    }


    recognize(shape) {

        if (app.time() - this.start_wait > WAIT_NEXT_STROKE) {
            this.waiting_next_stroke = false;
        }

        let result = this.#recognize_simple(shape);
        if (result) {
            this.#process_simple_result(result, shape);
            return;
        }

        /////////// not simple stroke

        let coords = [];
        let candidates = this.#init_candidates();

        if (!this.waiting_next_stroke) {
            this.bb = structuredClone(shape.bounds);
        }

        // copy coordinates
        for (const coord of shape.coords) {
            coords.push(coord.clone());
        }

        coords = this.#normalize(coords);
        this.#simplify_by_angle(coords, 0.8);
        this.#simplify_by_angle(coords, 0.4);
        this.#simplify_by_distance(coords, 0.1);
        this.#simplify_by_distance(coords, 0.2);

        let angles = [];
        for (let i = 0; i < coords.length - 1; i++) {
            let segment = new Victor(coords[i + 1].x - coords[i].x, -(coords[i + 1].y - coords[i].y));
            let angle = segment.angle() < 0 ? segment.angle() + Math.PI * 2 : segment.angle();
            angles.push(direction(angle));
        }

        // find candidates
        for (let i = 0; i < angles.length; i++) {
            for (let j = 0; j < candidates.length; j++) {
                if (!candidates[j].candidate) continue;
                if (candidates[j].angles.length != angles.length) {
                    candidates[j].candidate = false;
                }
                if (candidates[j].angles[i] != angles[i]) {
                    candidates[j].candidate = false;
                }
            }
        }

        let recognized = candidates.filter(c => c.candidate);

        // console.log(recognized);
        // get set of uniq values with digits
        result = [...new Set(recognized.map(v => v.digit))];

        // decide between 0 and 6
        if (result.indexOf(0) !== -1 && result.indexOf(6) !== -1) {
            const diff = coords[coords.length - 1].y - coords[0].y;
            if (diff > 0.2) {
                result = [6];
            } else {
                result = [0];
            }
        }

        this.prev_angles = [...angles];
        if (navigator['clipboard']) {
            navigator.clipboard.writeText(angles.join(', '));
        }


        if (this.waiting_next_stroke) {
            const a = this.#cell_from_point(coords[0]);
            const same_cells = a.x == this.prev_cell.x && a.y == this.prev_cell.y;

            if (this.prev_result[0] == 7) {
                if (result[0] == '7b') {
                    const lastpoint = coords[coords.length - 1];
                    const prevpoint = coords[coords.length - 2];
                    if (prev_bb.y == bb.y && prev_bb.y2 == bb.y2) {
                        this.bb = this.prev_bb;
                        result = [7];
                    } else {
                        result = [];
                    }
                } else {
                    result = [];
                }
            }
        } else {
            // 7b cannot be the first stroke
            if (result[0] == '7b') {
                result.splice(0, 1);
            }
        }

        this.prev_result = [...result];

        if (!this.waiting_next_stroke && result.length > 0 && (result[0] == 7 || result[0] == '·')) {
            this.waiting_next_stroke = true;
            this.prev_cell = this.#cell_from_point(coords[0]);

            setTimeout(this.#cancel_wait.apply(this, [this.prev_result[0], shape]), 700);
        } else {
            this.waiting_next_stroke = false;
            // if (DEBUG) debug();
            // else 
            setTimeout(this.commit_result.apply(this, [this.prev_result[0], shape]), 200);
        }
    }

    commit_result(result, shape) {
        if (this.prev_shape) this.prev_shape.el.parentNode.removeChild(this.prev_shape.el);
        if (shape) shape.el.parentNode.removeChild(shape.el);

        const cell_width = app.line_height * app.grid_ratio;
        const cell_height = app.line_height;

        let x = (shape.bounds.x + shape.bounds.x2) / 2;
        let y = (shape.bounds.y + shape.bounds.y2) / 2;

        let cell = this.#cell_from_point(new Victor(x, y));
        this.prev_cell = cell.clone();

        x = cell.x * cell_width;
        y = cell.y * cell_height;

        console.log('result: ', result);

        const text = app.page.add_text(x, y, result, app.line_height, '#215');
        app.page.set_cell(x, y, result, text);
        // else {
        //     app.page.clear_cell(x, y);
        //     console.log(this.prev_angles.join(", "));
        // }
    }

    #cancel_wait(result, shape) {
        console.log('cancel wait', result);
        if (result.length > 1) {
            result.splice(0, 1);
        }
        this.waiting_next_stroke = false;
        this.commit_result(result, shape);
    }


    #recognize_simple(shape) {
        let coords = shape.coords;
        // dot
        let accum_distances = 0;
        const center = coords[0];
        for (let i = 1; i < coords.length; i++) {
            accum_distances += coords[i - 1].distance(coords[i]);
        }
        if (accum_distances < app.line_height * 0.3) {
            return '·';
        }
        return null;
    }

    #process_simple_result(result, shape) {

        if (!this.waiting_next_stroke) {
            if (result == '·') {
                this.waiting_next_stroke = true;
                this.start_wait = app.time();
            }
            // result
            this.commit_result(result, shape);
        } else {
            const a = this.#cell_from_point(shape.coords[0]);
            const same_cells = a.x == this.prev_cell.x && a.y == this.prev_cell.y;

            if (this.prev_result == '·' && result == '·' && same_cells) {
                result = ':';
            }
            this.commit_result(result, shape);
            this.waiting_next_stroke = false;
        }

        this.prev_cell = this.#cell_from_point(shape.coords[0]);
        this.prev_result = result;
        return;
    }


    #cell_from_point(p) {
        const cell_width = app.line_height * app.grid_ratio;
        const cell_height = app.line_height;
        return new Victor(
            Math.floor(p.x / cell_width),
            Math.floor(p.y / cell_height)
        );
    }

    #relative_cell_coords(p) {
        const cell_width = app.line_height * app.grid_ratio;
        const cell_height = app.line_height;
        return new Victor(
            p.x % cell_width / cell_width,
            p.y % cell_height / cell_height
        );
    }

    #normalize(coords) {
        let w = this.bb.x2 - this.bb.x;
        let h = this.bb.y2 - this.bb.y;
        // let size = Math.max(w, h);

        for (let i = 0; i < coords.length; i++) {
            coords[i].x = (coords[i].x - this.bb.x) / w;
            coords[i].y = (coords[i].y - this.bb.y) / h;
        }

        return coords;
    }

    #simplify_by_distance(coords, threshold) {
        while (true) {
            let prev_length = coords.length;
            for (let i = 1; i < coords.length; i++) {
                let a = Victor.fromObject(coords[i - 1]);
                let b = Victor.fromObject(coords[i]);

                if (a.distance(b) < threshold) {
                    coords.splice(i, 1);
                    break;
                }
            }
            if (prev_length == coords.length) {
                break;
            }
        }
        return coords;
    }

    #simplify_by_angle(coords, threshold) {
        while (true) {
            let prev_length = coords.length;
            let sorted = [];
            if (coords.length < 3) {
                break;
            }
            for (let i = 1; i < coords.length - 1; i++) {
                let a = Victor.fromObject(coords[i - 1]);
                let b = Victor.fromObject(coords[i]);
                let c = Victor.fromObject(coords[i + 1]);

                let B = c.subtract(b);
                let A = b.subtract(a);
                B.normalize();
                A.normalize();
                let dot = A.dot(B);
                sorted.push({ dot: dot, index: i });
            }
            sorted.sort((a, b) => b.dot - a.dot);
            if (sorted[0].dot > threshold) {
                coords.splice(sorted[0].index, 1);
            }
            if (prev_length == coords.length || coords.length < 3) {
                break;
            }
        }
        return coords;
    }

    #init_candidates() {
        let candidates = [
            { digit: 0, angles: [RIGHT, DOWN, LEFT, UP], candidate: true },
            { digit: 0, angles: [RIGHT, DOWN_LEFT, UP], candidate: true },
            { digit: 0, angles: [DOWN_LEFT, RIGHT, UP_LEFT], candidate: true },
            { digit: 0, angles: [DOWN, RIGHT, UP, LEFT], candidate: true },
            { digit: 0, angles: [DOWN, UP_RIGHT, UP, LEFT], candidate: true },
            { digit: 0, angles: [DOWN, UP_RIGHT, UP_LEFT], candidate: true },
            { digit: 0, angles: [DOWN, RIGHT, UP_LEFT], candidate: true },
            { digit: 0, angles: [DOWN, RIGHT, UP, UP_LEFT], candidate: true },
            { digit: 0, angles: [DOWN_LEFT, DOWN_RIGHT, UP_RIGHT, UP_LEFT], candidate: true },
            { digit: 0, angles: [DOWN_LEFT, DOWN_RIGHT, UP, LEFT], candidate: true },
            { digit: 0, angles: [DOWN_LEFT, DOWN_RIGHT, UP, UP_LEFT], candidate: true },
            { digit: 0, angles: [DOWN_LEFT, DOWN, UP_RIGHT, UP_LEFT], candidate: true },
            { digit: 0, angles: [DOWN_LEFT, DOWN, RIGHT, UP_LEFT], candidate: true },
            { digit: 0, angles: [DOWN_LEFT, RIGHT, UP_RIGHT, UP_LEFT], candidate: true },
            { digit: 0, angles: [DOWN_LEFT, UP_RIGHT, UP_LEFT], candidate: true },
            { digit: 0, angles: [DOWN_LEFT, UP_RIGHT, UP, LEFT], candidate: true },
            { digit: 0, angles: [LEFT, DOWN, RIGHT, UP_LEFT], candidate: true },
            { digit: 0, angles: [LEFT, DOWN, RIGHT, UP], candidate: true },
            { digit: 0, angles: [LEFT, DOWN, RIGHT, UP, LEFT], candidate: true },
            { digit: 0, angles: [DOWN_LEFT, RIGHT, UP_LEFT, LEFT], candidate: true },
            { digit: 0, angles: [DOWN_LEFT, RIGHT, UP, UP_LEFT], candidate: true },
            { digit: 0, angles: [DOWN_LEFT, RIGHT, UP, LEFT], candidate: true },
            { digit: 0, angles: [DOWN_LEFT, RIGHT, LEFT], candidate: true },
            { digit: 0, angles: [DOWN_LEFT, DOWN, RIGHT, UP, LEFT], candidate: true },
            { digit: 0, angles: [DOWN_LEFT, RIGHT, UP_RIGHT, LEFT], candidate: true },
            { digit: 0, angles: [DOWN_LEFT, DOWN_RIGHT, UP_RIGHT, LEFT], candidate: true },
            { digit: 0, angles: [DOWN_LEFT, DOWN_RIGHT, UP_RIGHT, UP, LEFT], candidate: true },
            { digit: 0, angles: [DOWN_LEFT, DOWN_RIGHT, UP_LEFT], candidate: true },
            { digit: 0, angles: [DOWN_LEFT, DOWN, RIGHT, LEFT], candidate: true },
            { digit: 0, angles: [DOWN_LEFT, UP_RIGHT, LEFT], candidate: true },
            { digit: 0, angles: [LEFT, DOWN_RIGHT, RIGHT, UP_LEFT], candidate: true },
            { digit: 0, angles: [DOWN, UP_RIGHT, LEFT], candidate: true },
            { digit: 0, angles: [DOWN, RIGHT, LEFT], candidate: true },
            { digit: 0, angles: [LEFT, DOWN, UP_RIGHT, LEFT], candidate: true },

            { digit: 1, angles: [UP_RIGHT, DOWN], candidate: true },
            { digit: 1, angles: [UP_RIGHT, DOWN_LEFT], candidate: true },
            { digit: 1, angles: [UP_RIGHT, DOWN, DOWN_RIGHT], candidate: true },

            { digit: 2, angles: [RIGHT, DOWN_LEFT, RIGHT], candidate: true },
            { digit: 2, angles: [RIGHT, DOWN, RIGHT], candidate: true },
            { digit: 2, angles: [RIGHT, DOWN, DOWN_RIGHT], candidate: true },
            { digit: 2, angles: [RIGHT, DOWN_LEFT, DOWN_RIGHT], candidate: true },
            { digit: 2, angles: [DOWN_RIGHT, DOWN_LEFT, RIGHT], candidate: true },
            { digit: 2, angles: [RIGHT, DOWN_RIGHT, DOWN_LEFT, RIGHT], candidate: true },

            { digit: 3, angles: [RIGHT, DOWN_LEFT, RIGHT, DOWN_LEFT], candidate: true },
            { digit: 3, angles: [RIGHT, DOWN_LEFT, DOWN_RIGHT, DOWN_LEFT], candidate: true },
            { digit: 3, angles: [RIGHT, DOWN_LEFT, DOWN_RIGHT, LEFT], candidate: true },
            { digit: 3, angles: [RIGHT, DOWN_LEFT, RIGHT, LEFT], candidate: true },
            { digit: 3, angles: [DOWN_RIGHT, DOWN_LEFT, RIGHT, LEFT], candidate: true },
            { digit: 3, angles: [DOWN_RIGHT, DOWN_LEFT, DOWN_RIGHT, LEFT], candidate: true },
            { digit: 3, angles: [RIGHT, DOWN_LEFT, RIGHT, DOWN, LEFT], candidate: true },
            { digit: 3, angles: [RIGHT, DOWN, DOWN_LEFT, RIGHT, DOWN_LEFT], candidate: true },
            { digit: 3, angles: [RIGHT, DOWN, DOWN_LEFT, RIGHT, LEFT], candidate: true },
            { digit: 3, angles: [RIGHT, LEFT, RIGHT, DOWN, LEFT], candidate: true },
            { digit: 3, angles: [RIGHT, DOWN_LEFT, RIGHT, DOWN, LEFT], candidate: true },
            { digit: 3, angles: [RIGHT, DOWN_LEFT, RIGHT, DOWN, DOWN_LEFT], candidate: true },
            { digit: 3, angles: [RIGHT, DOWN_LEFT, DOWN_RIGHT, DOWN, LEFT], candidate: true },
            { digit: 3, angles: [RIGHT, DOWN, LEFT, RIGHT, DOWN_LEFT], candidate: true },
            { digit: 3, angles: [RIGHT, DOWN, LEFT, RIGHT, DOWN, LEFT], candidate: true },
            { digit: 3, angles: [RIGHT, DOWN, LEFT, RIGHT, LEFT], candidate: true },
            { digit: 3, angles: [RIGHT, LEFT, RIGHT, LEFT], candidate: true },

            { digit: 3, angles: [DOWN_LEFT, RIGHT, DOWN_LEFT, RIGHT], candidate: true },
            { digit: 3, angles: [LEFT, DOWN, DOWN_RIGHT, DOWN_LEFT, RIGHT], candidate: true },
            { digit: 3, angles: [LEFT, RIGHT, LEFT, DOWN, RIGHT], candidate: true },
            { digit: 3, angles: [LEFT, DOWN, RIGHT, LEFT, RIGHT], candidate: true },
            { digit: 3, angles: [LEFT, DOWN, RIGHT, LEFT, DOWN, RIGHT], candidate: true },
            { digit: 3, angles: [LEFT, DOWN, RIGHT, DOWN_LEFT, RIGHT], candidate: true },
            { digit: 3, angles: [LEFT, RIGHT, DOWN_LEFT, RIGHT], candidate: true },
            { digit: 3, angles: [LEFT, RIGHT, DOWN, LEFT, RIGHT], candidate: true },
            { digit: 3, angles: [DOWN_LEFT, RIGHT, DOWN_LEFT, RIGHT], candidate: true },
            { digit: 3, angles: [DOWN_LEFT, RIGHT, LEFT, RIGHT], candidate: true },



            { digit: 4, angles: [DOWN, RIGHT, UP_RIGHT, DOWN], candidate: true },
            { digit: 4, angles: [DOWN, RIGHT, UP, DOWN], candidate: true },
            { digit: 4, angles: [DOWN, RIGHT, DOWN], candidate: true },
            { digit: 4, angles: [DOWN, RIGHT, DOWN_LEFT], candidate: true },
            { digit: 4, angles: [DOWN_RIGHT, DOWN], candidate: true },
            { digit: 4, angles: [DOWN_RIGHT, UP, DOWN], candidate: true },
            { digit: 4, angles: [DOWN_RIGHT, RIGHT, DOWN], candidate: true },
            { digit: 4, angles: [DOWN_RIGHT, UP_RIGHT, DOWN], candidate: true },
            { digit: 4, angles: [DOWN, RIGHT, UP_LEFT, DOWN], candidate: true },
            { digit: 4, angles: [DOWN_RIGHT, RIGHT, UP_LEFT, DOWN], candidate: true },
            { digit: 4, angles: [DOWN_LEFT, RIGHT, UP_LEFT, DOWN], candidate: true },
            { digit: 4, angles: [DOWN_LEFT, RIGHT, UP, DOWN], candidate: true },
            { digit: 4, angles: [DOWN_LEFT, RIGHT, DOWN], candidate: true },
            { digit: 4, angles: [DOWN_LEFT, DOWN_RIGHT, RIGHT, DOWN], candidate: true },
            { digit: 4, angles: [DOWN_RIGHT, RIGHT, UP, DOWN], candidate: true },
            { digit: 4, angles: [DOWN, RIGHT, UP, DOWN_RIGHT], candidate: true },
            { digit: 4, angles: [DOWN_RIGHT, RIGHT, UP, DOWN_RIGHT], candidate: true },
            { digit: 4, angles: [DOWN, RIGHT, UP, DOWN_LEFT], candidate: true },
            { digit: 4, angles: [DOWN, RIGHT, UP, DOWN_LEFT, DOWN_RIGHT], candidate: true },

            { digit: 5, angles: [LEFT, DOWN, RIGHT, DOWN, LEFT], candidate: true },
            { digit: 5, angles: [LEFT, DOWN, RIGHT, LEFT], candidate: true },
            { digit: 5, angles: [LEFT, DOWN_RIGHT, DOWN_LEFT], candidate: true },
            { digit: 5, angles: [LEFT, DOWN, DOWN_RIGHT, LEFT], candidate: true },
            { digit: 5, angles: [LEFT, DOWN, DOWN_RIGHT, DOWN_LEFT], candidate: true },
            { digit: 5, angles: [LEFT, DOWN, RIGHT, DOWN_LEFT], candidate: true },
            { digit: 5, angles: [LEFT, DOWN_RIGHT, LEFT], candidate: true },
            { digit: 5, angles: [LEFT, DOWN_RIGHT, DOWN_LEFT, UP_LEFT], candidate: true },
            { digit: 5, angles: [LEFT, DOWN_RIGHT, DOWN_LEFT, LEFT], candidate: true },
            { digit: 5, angles: [LEFT, DOWN_RIGHT, DOWN, UP_LEFT], candidate: true },
            { digit: 5, angles: [LEFT, DOWN_RIGHT, DOWN, LEFT], candidate: true },
            { digit: 5, angles: [LEFT, RIGHT, DOWN, LEFT], candidate: true },
            { digit: 5, angles: [LEFT, DOWN_LEFT, RIGHT, DOWN, LEFT], candidate: true },
            { digit: 5, angles: [LEFT, DOWN_LEFT, DOWN_RIGHT, LEFT], candidate: true },
            { digit: 5, angles: [DOWN_LEFT, DOWN_RIGHT, LEFT], candidate: true },
            { digit: 5, angles: [DOWN_LEFT, DOWN_RIGHT, DOWN_LEFT], candidate: true },
            { digit: 5, angles: [DOWN_LEFT, RIGHT, DOWN_LEFT], candidate: true },
            { digit: 5, angles: [DOWN_LEFT, RIGHT, DOWN, LEFT], candidate: true },

            { digit: 5, angles: [RIGHT, DOWN, LEFT, RIGHT], candidate: true },
            { digit: 5, angles: [RIGHT, DOWN, DOWN_LEFT, RIGHT], candidate: true },
            { digit: 5, angles: [RIGHT, DOWN, LEFT, DOWN, RIGHT], candidate: true },
            { digit: 5, angles: [RIGHT, DOWN, LEFT, DOWN_RIGHT], candidate: true },
            { digit: 5, angles: [RIGHT, DOWN, LEFT, DOWN, RIGHT], candidate: true },
            { digit: 5, angles: [RIGHT, DOWN, DOWN_LEFT, RIGHT], candidate: true },
            { digit: 5, angles: [RIGHT, DOWN, LEFT, RIGHT], candidate: true },
            { digit: 5, angles: [RIGHT, DOWN, LEFT, DOWN, RIGHT], candidate: true },
            { digit: 5, angles: [RIGHT, DOWN, LEFT, RIGHT], candidate: true },


            // 6 is same as 0

            { digit: 7, angles: [RIGHT, DOWN], candidate: true },
            { digit: 7, angles: [RIGHT, DOWN_LEFT], candidate: true },
            { digit: 7, angles: [DOWN_RIGHT, DOWN_LEFT], candidate: true },

            { digit: '7b', angles: [RIGHT], candidate: true },
            { digit: '7b', angles: [DOWN_RIGHT], candidate: true },
            { digit: '7b', angles: [UP_RIGHT], candidate: true },

            { digit: 8, angles: [RIGHT, DOWN_LEFT, UP_RIGHT, UP_LEFT, RIGHT], candidate: true },
            { digit: 8, angles: [RIGHT, DOWN_LEFT, RIGHT, UP_LEFT], candidate: true },
            { digit: 8, angles: [RIGHT, DOWN, RIGHT, UP_LEFT], candidate: true },
            { digit: 8, angles: [RIGHT, DOWN_LEFT, RIGHT, UP_LEFT, UP_RIGHT], candidate: true },
            { digit: 8, angles: [RIGHT, DOWN_LEFT, UP_RIGHT, UP_LEFT], candidate: true },
            { digit: 8, angles: [RIGHT, DOWN_LEFT, RIGHT, UP], candidate: true },
            { digit: 8, angles: [RIGHT, DOWN_LEFT, DOWN_RIGHT, UP_LEFT], candidate: true },
            { digit: 8, angles: [LEFT, DOWN_RIGHT, DOWN_LEFT, LEFT, UP_RIGHT, UP_LEFT], candidate: true },
            { digit: 8, angles: [LEFT, DOWN_RIGHT, UP_LEFT, UP_RIGHT, UP_LEFT], candidate: true },
            { digit: 8, angles: [LEFT, DOWN_RIGHT, LEFT, UP_RIGHT, LEFT], candidate: true },
            { digit: 8, angles: [LEFT, DOWN_RIGHT, LEFT, UP, UP_RIGHT, UP_LEFT], candidate: true },
            { digit: 8, angles: [LEFT, DOWN_RIGHT, DOWN, LEFT, UP_LEFT, UP_RIGHT, UP_LEFT], candidate: true },
            { digit: 8, angles: [LEFT, DOWN_RIGHT, DOWN, LEFT, UP_RIGHT], candidate: true },
            { digit: 8, angles: [LEFT, DOWN_RIGHT, DOWN, LEFT, UP_RIGHT, LEFT], candidate: true },
            { digit: 8, angles: [LEFT, DOWN_RIGHT, DOWN_LEFT, LEFT, UP_RIGHT], candidate: true },
            { digit: 8, angles: [LEFT, DOWN_RIGHT, LEFT, UP_RIGHT, UP_LEFT], candidate: true },
            { digit: 8, angles: [LEFT, DOWN_RIGHT, UP_LEFT, UP_RIGHT, LEFT], candidate: true },
            { digit: 8, angles: [DOWN_LEFT, DOWN_RIGHT, LEFT, UP_RIGHT, LEFT], candidate: true },
            { digit: 8, angles: [DOWN_LEFT, DOWN_RIGHT, LEFT, UP_RIGHT, LEFT], candidate: true },
            { digit: 8, angles: [DOWN_LEFT, RIGHT, DOWN, LEFT, UP_RIGHT], candidate: true },
            { digit: 8, angles: [DOWN_LEFT, DOWN_RIGHT, DOWN_LEFT, UP_RIGHT], candidate: true },
            { digit: 8, angles: [DOWN_LEFT, DOWN_RIGHT, LEFT, UP_RIGHT], candidate: true },
            { digit: 8, angles: [LEFT, DOWN_RIGHT, DOWN_LEFT, UP_RIGHT, LEFT], candidate: true },
            { digit: 8, angles: [LEFT, DOWN, DOWN_RIGHT, LEFT, UP_RIGHT], candidate: true },
            { digit: 8, angles: [LEFT, RIGHT, DOWN_LEFT, UP_RIGHT], candidate: true },
            { digit: 8, angles: [RIGHT, DOWN, DOWN_LEFT, RIGHT, UP_LEFT], candidate: true },
            { digit: 8, angles: [RIGHT, DOWN_LEFT, RIGHT, UP_RIGHT, UP_LEFT], candidate: true },
            { digit: 8, angles: [DOWN_RIGHT, DOWN_LEFT, RIGHT, UP_LEFT, UP_RIGHT], candidate: true },
            { digit: 8, angles: [RIGHT, DOWN_LEFT, RIGHT, UP, UP_LEFT], candidate: true },
            { digit: 8, angles: [DOWN_RIGHT, DOWN, RIGHT, UP_LEFT], candidate: true },
            { digit: 8, angles: [DOWN_RIGHT, DOWN_LEFT, RIGHT, UP], candidate: true },
            { digit: 8, angles: [LEFT, DOWN_RIGHT, LEFT, UP, RIGHT], candidate: true },
            { digit: 8, angles: [LEFT, DOWN_RIGHT, DOWN_LEFT, UP, UP_RIGHT], candidate: true },
            { digit: 8, angles: [LEFT, DOWN_RIGHT, LEFT, UP], candidate: true },
            { digit: 8, angles: [LEFT, DOWN, DOWN_LEFT, UP_RIGHT], candidate: true },
            { digit: 8, angles: [LEFT, DOWN_RIGHT, LEFT, UP, UP_RIGHT], candidate: true },
            { digit: 8, angles: [DOWN_RIGHT, DOWN_LEFT, RIGHT, UP], candidate: true },

            { digit: 8, angles: [UP_RIGHT, UP_LEFT, RIGHT, DOWN], candidate: true },
            { digit: 8, angles: [UP_RIGHT, LEFT, RIGHT, DOWN_LEFT], candidate: true },
            { digit: 8, angles: [RIGHT, UP_LEFT, RIGHT, DOWN_LEFT], candidate: true },
            { digit: 8, angles: [UP_RIGHT, UP_LEFT, RIGHT, DOWN_LEFT], candidate: true },
            { digit: 8, angles: [UP_RIGHT, UP_LEFT, RIGHT, DOWN, RIGHT], candidate: true },
            { digit: 8, angles: [RIGHT, UP_LEFT, DOWN_RIGHT, DOWN_LEFT], candidate: true },
            { digit: 8, angles: [UP_RIGHT, UP_LEFT, UP_RIGHT, RIGHT, DOWN], candidate: true },
            { digit: 8, angles: [UP_RIGHT, UP_LEFT, RIGHT, DOWN_LEFT, RIGHT], candidate: true },
            { digit: 8, angles: [RIGHT, UP_LEFT, RIGHT, DOWN_LEFT, DOWN_RIGHT], candidate: true },
            { digit: 8, angles: [UP_RIGHT, UP_LEFT, UP_RIGHT, RIGHT, DOWN_LEFT], candidate: true },
            { digit: 8, angles: [UP_RIGHT, UP_LEFT, RIGHT, DOWN_LEFT, DOWN_RIGHT], candidate: true },
            { digit: 8, angles: [RIGHT, UP_LEFT, UP, RIGHT, DOWN_LEFT, DOWN_RIGHT], candidate: true },
            { digit: 8, angles: [UP_RIGHT, UP, UP_LEFT, RIGHT, DOWN_LEFT, DOWN_RIGHT], candidate: true },
            { digit: 8, angles: [UP_RIGHT, UP_LEFT, UP_RIGHT, RIGHT, DOWN_LEFT, DOWN_RIGHT], candidate: true },
            { digit: 8, angles: [UP_RIGHT, LEFT, RIGHT, DOWN_LEFT, DOWN_RIGHT], candidate: true },
            { digit: 8, angles: [RIGHT, UP_LEFT, UP, DOWN_RIGHT, DOWN_LEFT], candidate: true },
            { digit: 8, angles: [UP_RIGHT, UP_LEFT, UP_RIGHT, DOWN_LEFT, DOWN_RIGHT], candidate: true },
            { digit: 8, angles: [UP_RIGHT, UP_LEFT, UP, RIGHT, DOWN, DOWN_LEFT, DOWN_RIGHT], candidate: true },
            { digit: 8, angles: [UP_RIGHT, UP_LEFT, UP_RIGHT, DOWN_RIGHT, DOWN_LEFT], candidate: true },
            { digit: 8, angles: [UP_RIGHT, UP_LEFT, DOWN_RIGHT, DOWN_LEFT], candidate: true },
            { digit: 8, angles: [UP_RIGHT, UP_LEFT, UP_RIGHT, DOWN_LEFT], candidate: true },
            { digit: 8, angles: [UP_LEFT, UP_RIGHT, UP, LEFT, DOWN_RIGHT], candidate: true },
            { digit: 8, angles: [UP_LEFT, RIGHT, UP_LEFT, DOWN], candidate: true },
            { digit: 8, angles: [UP_LEFT, RIGHT, UP_LEFT, DOWN_LEFT, DOWN_RIGHT], candidate: true },
            { digit: 8, angles: [LEFT, UP, RIGHT, UP_LEFT, DOWN_LEFT, DOWN_RIGHT], candidate: true },


            { digit: 9, angles: [LEFT, RIGHT, UP, DOWN], candidate: true },
            { digit: 9, angles: [LEFT, RIGHT, DOWN], candidate: true },
            { digit: 9, angles: [LEFT, RIGHT, DOWN_RIGHT], candidate: true },
            { digit: 9, angles: [LEFT, RIGHT, DOWN_LEFT], candidate: true },
            { digit: 9, angles: [LEFT, DOWN, RIGHT, UP, DOWN], candidate: true },
            { digit: 9, angles: [LEFT, DOWN, RIGHT, UP_RIGHT, DOWN], candidate: true },
            { digit: 9, angles: [LEFT, RIGHT, UP, DOWN_LEFT], candidate: true },
            { digit: 9, angles: [LEFT, RIGHT, UP_LEFT, DOWN], candidate: true },
            { digit: 9, angles: [LEFT, RIGHT, UP_RIGHT, DOWN], candidate: true },
            { digit: 9, angles: [LEFT, DOWN_RIGHT, UP_RIGHT, DOWN], candidate: true },
            { digit: 9, angles: [LEFT, RIGHT, UP_RIGHT, DOWN_LEFT], candidate: true },
            { digit: 9, angles: [LEFT, DOWN_LEFT, RIGHT, UP, DOWN], candidate: true },
            { digit: 9, angles: [LEFT, DOWN_LEFT, RIGHT, DOWN], candidate: true },
            { digit: 9, angles: [LEFT, DOWN, RIGHT, DOWN], candidate: true },
            { digit: 9, angles: [LEFT, DOWN_RIGHT, UP, DOWN], candidate: true },
            { digit: 9, angles: [LEFT, DOWN, UP_RIGHT, DOWN], candidate: true },
            { digit: 9, angles: [LEFT, RIGHT, DOWN_LEFT, DOWN_RIGHT], candidate: true },

            { digit: '(', angles: [LEFT, DOWN, RIGHT], candidate: true },
            { digit: '(', angles: [LEFT, DOWN, DOWN_RIGHT], candidate: true },
            { digit: '(', angles: [DOWN_LEFT, DOWN, DOWN_RIGHT], candidate: true },
            { digit: '(', angles: [DOWN_LEFT, DOWN_RIGHT], candidate: true },
            { digit: '(', angles: [DOWN_LEFT, RIGHT], candidate: true },
            { digit: '(', angles: [DOWN_LEFT, DOWN, RIGHT], candidate: true },

            { digit: ')', angles: [RIGHT, DOWN, LEFT], candidate: true },
            { digit: ')', angles: [RIGHT, DOWN, DOWN_LEFT], candidate: true },
            { digit: ')', angles: [DOWN_RIGHT, DOWN, DOWN_LEFT], candidate: true },
            { digit: ')', angles: [DOWN_RIGHT, DOWN_LEFT], candidate: true },
            { digit: ')', angles: [DOWN_RIGHT, LEFT], candidate: true },
            { digit: ')', angles: [DOWN_RIGHT, DOWN, LEFT], candidate: true },

            // less priority
            { digit: 5, angles: [DOWN_LEFT, RIGHT, LEFT], candidate: true },
            { digit: 4, angles: [DOWN_LEFT, RIGHT, DOWN_LEFT], candidate: true },
            { digit: 0, angles: [DOWN_LEFT, RIGHT, UP_LEFT], candidate: true },
        ];

        // mirror 8
        let mirrored = [];
        for (let i = 0; i < candidates.length; i++) {
            const digit = candidates[i].digit;
            if (digit == 8 || digit == 5 || digit == 3) {
                const add = {
                    digit: digit,
                    angles: mirror_angles(candidates[i].angles),
                    candidate: true,
                }
                mirrored.push(add);
            }
        }
        candidates = candidates.concat(mirrored);

        // copy 0 to 6
        let zeros = [];
        for (let i = 0; i < candidates.length; i++) {
            const digit = candidates[i].digit;
            if (digit == 0) {
                zeros.push({
                    digit: 6,
                    angles: [...candidates[i].angles],
                    candidate: true,
                });
            }
        }
        candidates = candidates.concat(zeros);
        return candidates;
    }
}


const LEFT = 'LEFT';
const RIGHT = 'RIGHT';
const UP = 'UP';
const DOWN = 'DOWN';
const UP_LEFT = 'UP_LEFT';
const UP_RIGHT = 'UP_RIGHT';
const DOWN_RIGHT = 'DOWN_RIGHT';
const DOWN_LEFT = 'DOWN_LEFT';



function direction(a) {
    let d = a * 180 / Math.PI;
    // console.log(d);
    if (d < 15 || d > 340) return RIGHT;
    if (d < 200 && d > 160) return LEFT;
    if (d < 110 && d > 70) return UP;
    if (d < 290 && d > 250) return DOWN;

    if (d > 15 && d < 70) return UP_RIGHT;
    if (d > 110 && d < 160) return UP_LEFT;
    if (d > 200 && d < 250) return DOWN_LEFT;
    if (d > 290 && d < 340) return DOWN_RIGHT;
}

function mirror_angles(angles) {
    let mirrored = [];
    const reflection = {
        LEFT: RIGHT,
        RIGHT: LEFT,
        UP: DOWN,
        DOWN: UP,
        UP_LEFT: UP_RIGHT,
        UP_RIGHT: UP_LEFT,
        DOWN_RIGHT: DOWN_LEFT,
        DOWN_LEFT: DOWN_RIGHT,
    };
    for (let i = 0; i < angles.length; i++) {
        mirrored.push(reflection[angles[i]]);
    }
    return mirrored;
}
