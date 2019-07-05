var vert_source = `
    attribute vec2 a_Position;
    attribute vec3 a_Colour;

    uniform vec2 sun_position;

    varying vec4 vert_colour;
    varying vec2 vert_position;

    void main(void){
        gl_Position = vec4(a_Position, 0.0, 1.0);
        vert_colour = vec4(a_Colour, 1.0);
        vert_position = a_Position;
    }
`;

var frag_source = `
    precision mediump int;
    precision highp float;

    uniform vec2 sun_position;

    varying vec4 vert_colour;
    varying vec2 vert_position;

    float sunlight_scale(float distance, float radius, vec2 position){
        if(position.y < 0.0){
            return 0.0;
        }
        if(distance/radius < 0.08){
            return 0.6;
        } else if(distance/radius < 0.9){
            return 0.6 * (0.5 * cos(3.9 * distance / radius - 0.39) + 0.5);
        } else {
            return 0.0;
        }
    }

    float sun_scale(float distance, vec2 position){
        if(position.y >= 0.0){
            return 0.003 / (distance * distance);
        } else if(distance >= 0.035 && distance <= 0.04){
            return 1.0;
        } else {
            return 0.0;
        }
    }

    float sun_fill(float distance, vec2 position){
        if(position.y < 0.0 && distance <= 0.035){
            return 0.0;
        } else {
            return 1.0;
        }
    }

    float horison_sun_elevation_scale(vec2 sun){
        if(sun.y > -0.3 && sun.y <= 0.025){
            return 0.4 * pow(sun.y + 0.3, 2.0);
        } else if(sun.y > 0.025 && sun.y < 0.15){
            return 2.0 * pow(sun.y - 0.1705, 2.0);
        } else {
            return 0.0;
        }
    }

    float bell_curve(float x, float b, float c){
        return c * pow(2.718, - pow(x, 2.0) / b) - 0.04;
    }

    float horison_scale(vec2 position, vec2 sun){
        if(position.y < 0.0){
            return 0.0;
        }

        float b = 0.1;
        float c = horison_sun_elevation_scale(sun); //0.044;

        float y = bell_curve(position.x - sun.x, b, c);
        
        if(position.y <= y){
            return 10.0;
        } else {
            float x;
            float newDistance;
            float distance = 1.0;

            for(int i = -100; i <= 100; ++i){
                x = float(i) / 100.0;
                y = bell_curve(x - sun.x, b, c);
                
                newDistance = length(position - vec2(x, y));

                if(newDistance < distance){
                    distance = newDistance;
                }
            }
            
            return c * 0.2/(distance * distance) * 0.08/(length(position - sun));
        }
    }

    void main(void){
        vec4 sky_colour = vec4(0.529411765, 0.807843137, 0.980392157, 1);
        vec4 sunlight_colour = vec4(1.0, 1.0, 1.0, 1.0);
        
        float distance = length(sun_position - vert_position);
        float radius = 0.8;

        vec3 background = vert_colour.rgb * sun_fill(distance, vert_position);
        vec3 sky = sky_colour.rgb * sunlight_scale(distance, radius, vert_position);
        vec3 sun = sunlight_colour.rgb * sun_scale(distance, vert_position);

        gl_FragColor = vec4(background + 0.4 * sky + 0.4 * sun + 0.4 * horison_scale(vert_position, sun_position) * sunlight_colour.rgb, 1.0);

    }
`;

var previous_time = 0;
var current_angle = 0;

function create_shaders(gl) {
    // create shaders
    var vert = gl.createShader(gl.VERTEX_SHADER);
    var frag = gl.createShader(gl.FRAGMENT_SHADER);
    var program = gl.createProgram();

    gl.shaderSource(vert, vert_source);
    gl.shaderSource(frag, frag_source);

    // compile shaders
    gl.compileShader(vert);
    gl.compileShader(frag);

    // shader error handling
    if(!gl.getShaderParameter(vert, gl.COMPILE_STATUS) || !gl.getShaderParameter(frag, gl.COMPILE_STATUS)){
        console.error(gl.getShaderInfoLog(vert));
        console.error(gl.getShaderInfoLog(frag));
        throw new Error("Failed to compile shader");
    }

    // attach shaders to a program
    gl.attachShader(program, vert);
    gl.attachShader(program, frag);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        console.error(gl.getProgramInfoLog(program))
        throw new Error('Failed to link program')
    }

    return program;
}

function create_buffer(gl, data){
    // initialise buffer
    var buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(data), gl.STATIC_DRAW);
    return buffer;
}

function get_cos(amplitude, shift){
    // create points and colours from cosine wave
    var arr = [];
    var colours = [];
    for(var i = -1; i < 1; i = i + 0.01){
        arr.push(i);
        arr.push(amplitude * Math.cos(i * Math.PI) + shift);
        
        colours.push(0.5);
        colours.push(0.5);
        colours.push(0.5);
    }
    return {cosine:arr, cosine_colours:colours};
}

function draw(gl, program, position, frame, colours, cosine, cosine_colours, horison, horison_colours){
    // draw to canvas
    gl.clear(gl.COLOR_BUFFER_BIT);
    
    var a_Position = gl.getAttribLocation(program, "a_Position");
    var a_Colour = gl.getAttribLocation(program, "a_Colour");
    var sun_position = gl.getUniformLocation(program, "sun_position");

    var vertex_buffer = create_buffer(gl, frame);
    var colour_buffer = create_buffer(gl, colours);

    // set sun position
    gl.uniform2f(sun_position, position[0], position[1]);

    // draw background
    gl.bindBuffer(gl.ARRAY_BUFFER, vertex_buffer);
    gl.vertexAttribPointer(a_Position, 2, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(a_Position);

    gl.bindBuffer(gl.ARRAY_BUFFER, colour_buffer);
    gl.vertexAttribPointer(a_Colour, 3, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(a_Colour);
    
    gl.drawArrays(gl.TRIANGLES, 0, 6);

    // draw cosine wave
    var cosine_buffer = create_buffer(gl, cosine);
    gl.bindBuffer(gl.ARRAY_BUFFER, cosine_buffer);
    gl.vertexAttribPointer(a_Position, 2, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(a_Position);

    var cosine_colour_buffer = create_buffer(gl, cosine_colours)
    gl.bindBuffer(gl.ARRAY_BUFFER, cosine_colour_buffer);
    gl.vertexAttribPointer(a_Colour, 3, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(a_Colour);

    gl.drawArrays(gl.LINE_STRIP, 0, cosine.length / 2);

    // draw horison
    var horison_buffer = create_buffer(gl, horison);
    gl.bindBuffer(gl.ARRAY_BUFFER, horison_buffer);
    gl.vertexAttribPointer(a_Position, 2, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(a_Position);

    var horison_colour_buffer = create_buffer(gl, horison_colours)
    gl.bindBuffer(gl.ARRAY_BUFFER, horison_colour_buffer);
    gl.vertexAttribPointer(a_Colour, 3, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(a_Colour);

    gl.drawArrays(gl.LINES, 0, 2);

    // do animation: go through full day/night cycle
    window.requestAnimationFrame(function(current_time){
        var delta = (current_time - previous_time) / 50;

        position = [(current_angle - 180) / 180, 0.5 * Math.cos((current_angle - 180) * Math.PI / 180)];
        
        current_angle = (current_angle + delta) % 360;
        previous_time = current_time;
        draw(gl, program, position, frame, colours, cosine, cosine_colours, horison, horison_colours);
    });
}

window.onload = function(){
    // obtain webgl context
    var canvas = document.getElementById("canvas");
    var gl = canvas.getContext("webgl");
    //gl.enableVertexAttribArray(0);

    // clear canvas
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);

    var program = create_shaders(gl);
    gl.useProgram(program);

    // sun position
    var position = [0.0, 0.5 * Math.cos(0)];
    
    // background
    var frame = [-1, -1,    1, -1,    1, 1,
                 -1, -1,    -1, 1,    1, 1 ];
    var colours = [0, 0, 0,   0, 0, 0,   0, 0, 0,
                   0, 0, 0,   0, 0, 0,   0, 0, 0];

    // cosine wave
    var {cosine, cosine_colours} = get_cos(0.5, 0);
    
    //horison line
    var horison = [-1, 0, 1, 0];
    var horison_colours = [0.5, 0.5, 0.5, 0.5, 0.5, 0.5];
    
    // draw to canvas
    draw(gl, program, position, frame, colours, cosine, cosine_colours, horison, horison_colours);
}
