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

    uniform float altitude_scale;
    uniform vec2 aspect_ratio;
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
            return 0.15 * pow(sun.y + 0.3, 2.0);
        } else if(sun.y > 0.025 && sun.y < 0.15){
            return 0.8 * pow(sun.y - 0.1705, 2.0);
        } else {
            return 0.0;
        }
    }

    float bell_curve(float x, float b, float c){
        return c * pow(2.718, - pow(x, 2.0) / b) - 0.04;
    }

    float horison_sunlight_scale(float distance, float radius, vec2 position){
        if(position.y < 0.0){
            return 0.0;
        }
        if(distance/radius < 0.01){
            return 1.0;
        } else if(distance/radius < 0.9){
            return 1.0 * (0.5 * cos(3.9 * distance / radius - 0.2) + 0.5);
        } else {
            return 0.0;
        }
    }

    float horison_scale(vec2 position, vec2 sun, float radius){
        if(position.y < 0.0){
            return 0.0;
        }

        float b = 0.01;
        float c = horison_sun_elevation_scale(sun);

        float y = bell_curve(position.x - sun.x, b, c);
        
        if(position.y <= y){
            return 0.0;
        } else {
            float x;
            float newDistance;
            float distance = 0.2;

            for(int i = -100; i <= 100; ++i){
                x = float(i) / 100.0;
                y = bell_curve(x - sun.x, b, c);
                
                newDistance = length(position - vec2(x, y));

                if(newDistance < distance){
                    distance = newDistance;
                }
            }
            
            return (c / pow(distance, 2.0)) * horison_sunlight_scale(length(position - sun), 0.75 / aspect_ratio.x, position);
        }
    }

    float adjust_sunlight_radius(float default_radius, float sun_altitude){
        float night_cutoff_altitude = 0.3090169943749474; // represents 18 degrees below horizon
        if(sun_altitude < 0.0 - night_cutoff_altitude){
            return 0.0;
        }
        else if(sun_altitude < 0.0){
            return default_radius + (night_cutoff_altitude - default_radius) * abs(sun_altitude) / night_cutoff_altitude;
        }
        return default_radius;
    }

    void main(void){
        vec4 horison_colour;
        vec4 sky_colour = vec4(0.529411765, 0.807843137, 0.980392157, 1);
        vec4 sunlight_colour = vec4(1.0, 1.0, 1.0, 1.0);
        vec4 sunrise_colour = vec4(0.953, 0.906, 0.427, 1.0);
        vec4 sunset_colour = 1.2 * vec4(0.788, 0.106, 0.149, 1.0);
        
        float distance = length(sun_position * aspect_ratio - vert_position * aspect_ratio);
        
        // 0.8 is the radius to be adjusted
        float radius = adjust_sunlight_radius(0.8, sun_position.y / altitude_scale); 
        
        if(sun_position.x < 0.0){
            horison_colour = sunrise_colour;
        } else {
            horison_colour = sunset_colour;
        }

        vec3 background = vert_colour.rgb * sun_fill(distance, vert_position * aspect_ratio);
        vec3 sky = 1.0 * sky_colour.rgb * sunlight_scale(distance, radius, vert_position * aspect_ratio);
        vec3 sun = sunlight_colour.rgb * sun_scale(distance, vert_position * aspect_ratio);

        gl_FragColor = vec4(background + 0.8 * sky + 0.4 * sun + horison_scale(vert_position, sun_position, radius) * horison_colour.rgb * 0.3, 1.0);

    }
`;

var DEBUG = true;
var now = null;
var animate = true;

var previous_time = 0;
var prev_latitude = 0;
var prev_day_of_year = 0;

var latitude = 0;
var longitude = 0;
var day_of_year = 0;

var altitude_scale = 0.8;

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

function to_degrees(radians){
    // convert radians to degrees

    return radians * 180 / Math.PI;
}

function to_radians(degrees){
    // convert degrees to radians

    return degrees * Math.PI / 180;
}

function get_declination(day_of_year){
    // get sun's declination given current day of year

    return Math.asin(0.39795 * Math.cos(to_radians(0.98563 * (day_of_year - 173))));
}

function altitude_curve(day_of_year, latitude, hour_angle){
    // sin of sun's altitude given day, latitude, and hour angle

    var declination = get_declination(day_of_year);
    return altitude_scale * (Math.sin(declination) * Math.sin(latitude) + Math.cos(declination) * Math.cos(latitude) * Math.cos(hour_angle));
}

function equation_of_time(day_of_year){
    // solar noon offset in minutes
    
    var deg_per_day = 360 / 365.24;
    var orbital_angle = deg_per_day * (day_of_year + 10);
    
    var corrected_orbital_angle = orbital_angle + 1.914 * Math.sin(to_radians(deg_per_day) * (day_of_year - 2));
    var C = (orbital_angle - to_degrees(Math.atan(Math.tan(to_radians(corrected_orbital_angle)) / Math.cos(to_radians(23.44))))) / 180;

    return 720 * (C - Math.floor(C + 0.5));
}

function get_altitude_curve(day_of_year, latitude){
    // create points and colours from cosine wave
    var arr = [];
    var colours = [];
    for(var i = -1; i <= 1+0.01; i = i + 0.01){
        arr.push(i);
        //arr.push(amplitude * Math.cos(i * Math.PI) + shift);
        arr.push(altitude_curve(day_of_year, latitude, i * Math.PI))

        colours.push(0.5);
        colours.push(0.5);
        colours.push(0.5);
    }
    return {cosine:arr, cosine_colours:colours};
}

// useful Datetime functions
// from https://stackoverflow.com/questions/11887934/how-to-check-if-the-dst-daylight-saving-time-is-in-effect-and-if-it-is-whats
Date.prototype.stdTimezoneOffset = function () {
    var jan = new Date(this.getFullYear(), 0, 1);
    var jul = new Date(this.getFullYear(), 6, 1);
    return Math.max(jan.getTimezoneOffset(), jul.getTimezoneOffset());
}

// from https://stackoverflow.com/questions/11887934/how-to-check-if-the-dst-daylight-saving-time-is-in-effect-and-if-it-is-whats
Date.prototype.isDstObserved = function () {
    return this.getTimezoneOffset() < this.stdTimezoneOffset();
}

// check whether or not given year is leap
function is_leap(year){
    return ((year % 4 == 0) && !(year % 100 == 0)) || (year % 400 == 0);
}

// get current day of year
function get_day_of_year(date){
    var days_per_month = [0, 31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    var current_day = 0;

    for(var i = 0; i <= date.getMonth(); i++){
        current_day += days_per_month[i];
    }

    current_day += date.getDate();

    if (date.getMonth() > 1 && is_leap(date.getFullYear())){
        current_day++;
    }

    return current_day;
}

// get our angle in degrees for given datetime including longitude offset
function get_hour_angle(date, longitude){

    var eot = equation_of_time(get_day_of_year(date)); // offset in minutes using analemma
    var longitude_offset = (longitude / 180) * 720; // offset in minutes due to longitude
    //var solar_noon_offset = 0 - (eot + longitude_offset + date.getTimezoneOffset()); // offset has to be negative
    var solar_noon_offset = 0 - (eot + longitude_offset + date.getTimezoneOffset()); // offset has to be negative

    // offset noon by calculated number of minutes 
    var solar_noon = new Date(new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12, 0, 0, 0).getTime() + solar_noon_offset * 60 * 1000);
    
    //console.log("Solar noon:");
    //console.log(solar_noon.toString());
    var diff = (date.getTime() - solar_noon.getTime()) / 1000;
    
    // return hour angle in degrees
    return 180 * (diff / (720 * 60));
}

function refresh_screen(gl, program, position, frame, colours, cosine, cosine_colours, horison, horison_colours){
    now = new Date();
    draw(gl, program, position, frame, colours, cosine, cosine_colours, horison, horison_colours, true);
}

function draw(gl, program, position, frame, colours, cosine, cosine_colours, horison, horison_colours, animate){
    
    // draw to canvas
    gl.clear(gl.COLOR_BUFFER_BIT);
    
    var a_Position = gl.getAttribLocation(program, "a_Position");
    var a_Colour = gl.getAttribLocation(program, "a_Colour");
    var sun_position = gl.getUniformLocation(program, "sun_position");
    var aspect_ratio = gl.getUniformLocation(program, "aspect_ratio");
    var sun_altitude_scale = gl.getUniformLocation(program, "altitude_scale");

    var vertex_buffer = create_buffer(gl, frame);
    var colour_buffer = create_buffer(gl, colours);

    // set altitude scale
    gl.uniform1f(sun_altitude_scale, altitude_scale);

    //set aspect ratio
    var width = document.getElementById("canvas").offsetWidth;
    var height = document.getElementById("canvas").offsetHeight;
    gl.uniform2f(aspect_ratio, width / height, 1.0);

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
    if(!DEBUG){
        if(animate == true){
            
            window.requestAnimationFrame(function(){
                
                var current_angle = position[0] * 180 + 180;
                // hour angle is between -180 and 180
                var limit = (get_hour_angle(now, longitude) + 540) % 360;
                
                if (current_angle >= limit){
                    animate = false;
                    console.log("End. Starting refresh timer");
                    setTimeout(refresh_screen, 60000, gl, program, position, frame, colours, cosine, cosine_colours, horison, horison_colours, animate);
                }
                current_angle += Math.pow(Math.cos((current_angle / limit) * Math.PI) + 1, 0.25);
                
                // current sun position
                position = [(current_angle - 180) / 180, altitude_curve(get_day_of_year(now), to_radians(latitude), to_radians  (current_angle - 180))];
                
                draw(gl, program, position, frame, colours, cosine, cosine_colours, horison, horison_colours, animate);
            });
        }
    } else {
        window.requestAnimationFrame(function(){
            
            var current_angle = document.getElementById("position").value;
            
            latitude = document.getElementById("latitude").value;
            day_of_year = document.getElementById("day_of_year").value;
            
            // update curve if either day or latitude changed
            if (latitude != prev_latitude || day_of_year != prev_day_of_year){
                prev_latitude = latitude;
                prev_day_of_year = day_of_year;
                
                var curve = get_altitude_curve(day_of_year, to_radians(latitude));
                cosine = curve.cosine;
            }
            
            position = [(current_angle - 180) / 180, altitude_curve(prev_day_of_year, to_radians(prev_latitude), to_radians(current_angle - 180))];
            
            draw(gl, program, position, frame, colours, cosine, cosine_colours, horison, horison_colours, false);
        });
    }
    
}

window.onload = function(){
    // obtain webgl context
    var canvas = document.getElementById("canvas");
    canvas.height = 600;
    canvas.width = 600;

    //canvas.height = window.innerHeight;
    //canvas.width = window.innerWidth;

    var gl = canvas.getContext("webgl");
    
    // clear canvas
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);

    var program = create_shaders(gl);
    gl.useProgram(program);

    // location
    latitude = 51.499250;
    longitude = -0.108492;

    now = new Date();

    var hour_angle = 0;

    if(!DEBUG){
        if(animate){
            hour_angle = -180;
        } else {
            hour_angle = ((get_hour_angle(now, longitude) + 540) % 360) - 180;
        }
    }

    // sun position
    var position = [hour_angle / 180, altitude_curve(get_day_of_year(now), to_radians(latitude), to_radians(hour_angle))];
    
    // background
    var frame = [-1, -1,    1, -1,    1, 1,
                 -1, -1,    -1, 1,    1, 1 ];
    var colours = [0, 0, 0,   0, 0, 0,   0, 0, 0,
                   0, 0, 0,   0, 0, 0,   0, 0, 0];

    // sun altitude estimation
    var {cosine, cosine_colours} = get_altitude_curve(get_day_of_year(now), to_radians(latitude));
    
    //horison line
    var horison = [-1, 0, 1, 0];
    var horison_colours = [0.5, 0.5, 0.5, 0.5, 0.5, 0.5];
    
    // draw to canvas
    draw(gl, program, position, frame, colours, cosine, cosine_colours, horison, horison_colours, animate);

    //console.log(equation_of_time(139));
    //console.log(0 - (equation_of_time(139) + (longitude / 180) * 720));
}
