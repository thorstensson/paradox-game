import { Display, Renderer } from "phaser";

// Phaser's Shine (postFX.addShine) with the sweep's colour as a setting.
// Phaser bakes its colour into the shader; this is the same shader with that
// colour swapped for the `color` uniform. Like the original, the sweep is
// added on top of the object, so it brightens it towards the colour.
const FRAG_SHADER = `
precision mediump float;

uniform sampler2D uMainSampler;
uniform vec2 resolution;
uniform float speed;
uniform float time;
uniform float lineWidth;
uniform float gradient;
uniform vec3 color;

varying vec2 outTexCoord;

void main ()
{
    vec2 uv = gl_FragCoord.xy / resolution.xy;
    vec4 tex = texture2D(uMainSampler, outTexCoord);

    uv.x = uv.x - mod(time * speed, 2.0) + 0.5;
    float y = uv.x * gradient;
    float s = smoothstep(y - lineWidth, y, uv.y) - smoothstep(y, y + lineWidth, uv.y);

    gl_FragColor = s * vec4(color, 1.0) * tex + tex;
}
`;

// Registered in main.js under this name; put on with setPostPipeline().
export const COLOUR_SHINE = "ColourShine";

export class ColourShine extends Renderer.WebGL.Pipelines.PostFXPipeline {

    constructor(game) {
        super({ game, fragShader: FRAG_SHADER });

        // Phaser's Shine defaults.
        this.speed = 0.5;
        this.lineWidth = 0.5;
        this.gradient = 3;

        this.color = 0xb9bffb;
    }

    onPreRender() {
        const c = Display.Color.IntegerToColor(this.color);

        this.setTime("time");
        this.set1f("speed", this.speed);
        this.set1f("lineWidth", this.lineWidth);
        this.set1f("gradient", this.gradient);
        this.set3f("color", c.redGL, c.greenGL, c.blueGL);
    }

    onDraw(target) {
        this.set2f("resolution", target.width, target.height);
        this.bindAndDraw(target);
    }
}
