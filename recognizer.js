
class Recognizer {
    waiting_next_stroke;
    shape;
    stroke;
    bb;
    prev_shape;
    prev_bb;
    prev_angles;
    prev_result;

    constructor() {
        this.bb = {
            x: 999999,
            y: 999999,
            x2: 0,
            y2: 0,
        };
        // this.restart();

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
        this.prev_shape = this.shape;
    }


    recognize(shape) {
        this.shape = shape;
        this.stroke = [];
        let stroke = this.stroke;
        let candidates = this.#init_candidates();


        for (let i = 0; i < shape.coords.length; i++) {
            stroke.push({ x: shape.coords[i].x, y: shape.coords[i].y });
        }
        if (!this.waiting_next_stroke) {
            this.bb = structuredClone(shape.bounds);
        }

        this.#normalize();
        this.#simplify_by_angle(0.8);
        this.#simplify_by_angle(0.4);
        this.#simplify_by_distance(0.1);
        this.#simplify_by_distance(0.2);

        let angles = [];
        for (let i = 0; i < stroke.length - 1; i++) {
            let segment = new Victor(stroke[i + 1].x - stroke[i].x, -(stroke[i + 1].y - stroke[i].y));
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
        let result = [...new Set(recognized.map(v => v.digit))];
        console.log(result);

        // decide between 0 and 6
        if (result.indexOf(0) !== -1 && result.indexOf(6) !== -1) {
            const diff = stroke[stroke.length - 1].y - stroke[0].y;
            if (diff > 0.2) {
                result = [6];
            } else {
                result = [0];
            }
        }


        if (this.waiting_next_stroke) {
            if (this.prev_result[0] == 7) {
                if (result[0] == '7b') {
                    const lastpoint = stroke[stroke.length - 1];
                    const prevpoint = stroke[stroke.length - 2];
                    if (prev_bb.y == bb.y && prev_bb.y2 == bb.y2) {
                        bb = prev_bb;
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
        this.prev_angles = [...angles];

        if (navigator['clipboard']) {
            navigator.clipboard.writeText(angles.join(', '));
        }


        if (!this.waiting_next_stroke && result.length > 0 && result[0] == 7) {
            this.waiting_next_stroke = true;
            setTimeout(this.#cancel_wait.bind(this), 700);
        } else {
            this.waiting_next_stroke = false;
            // if (DEBUG) debug();
            // else 
            setTimeout(this.#show_result.bind(this), 200);
        }
    }


    #normalize() {
        let w = this.bb.x2 - this.bb.x;
        let h = this.bb.y2 - this.bb.y;
        // let size = Math.max(w, h);

        for (let i = 0; i < this.stroke.length; i++) {
            this.stroke[i].x = (this.stroke[i].x - this.bb.x) / w;
            this.stroke[i].y = (this.stroke[i].y - this.bb.y) / h;
        }
    }

    #simplify_by_distance(threshold) {
        while (true) {
            let prev_length = this.stroke.length;
            for (let i = 1; i < this.stroke.length; i++) {
                let a = Victor.fromObject(this.stroke[i - 1]);
                let b = Victor.fromObject(this.stroke[i]);

                if (a.distance(b) < threshold) {
                    this.stroke.splice(i, 1);
                    break;
                }
            }
            if (prev_length == this.stroke.length) {
                break;
            }
        }
    }

    #simplify_by_angle(threshold) {
        while (true) {
            let prev_length = this.stroke.length;
            let sorted = [];
            if (this.stroke.length < 3) {
                break;
            }
            for (let i = 1; i < this.stroke.length - 1; i++) {
                let a = Victor.fromObject(this.stroke[i - 1]);
                let b = Victor.fromObject(this.stroke[i]);
                let c = Victor.fromObject(this.stroke[i + 1]);

                let B = c.subtract(b);
                let A = b.subtract(a);
                B.normalize();
                A.normalize();
                let dot = A.dot(B);
                sorted.push({ dot: dot, index: i });
            }
            sorted.sort((a, b) => b.dot - a.dot);
            if (sorted[0].dot > threshold) {
                this.stroke.splice(sorted[0].index, 1);
            }
            if (prev_length == this.stroke.length || this.stroke.length < 3) {
                break;
            }
        }
    }


    #cancel_wait() {
        if (this.prev_result.length > 1) {
            this.prev_result.splice(0, 1);
        }
        this.waiting_next_stroke = false;
        this.#show_result();
    }

    #show_result() {
        if (this.prev_shape) this.prev_shape.el.parentNode.removeChild(this.prev_shape.el);
        this.shape.el.parentNode.removeChild(this.shape.el);

        this.shape = null;
        this.prev_shape = null;

        let x = (this.bb.x + this.bb.x2) / 2;
        let y = (this.bb.y + this.bb.y2) / 2;
        x = Math.floor(x / (app.line_height * app.grid_ratio)) * app.line_height * app.grid_ratio;
        y = Math.floor(y / app.line_height) * app.line_height;

        if (this.prev_result.length > 0) {
            console.log('result: ', this.prev_result[0]);

            const text = app.page.add_text(x, y, this.prev_result[0], app.line_height, '#215');
            app.page.set_cell(x, y, this.prev_result[0], text);
        } else {
            app.page.clear_cell(x, y);
            console.log(this.prev_angles.join(", "));
        }
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
