# Solar clock

An attempt to recreate [solar watch face](https://sixcolors.com/images/content/2015/solar2-6c.jpg) from Apple Watch in WebGL. This is currently a work in progress

##### Running:

To run it open index.html in a browser.

##### TODO:

- [ ] Sync with time of day and remove current animation
- [ ] Move drawing of consine wave and horison line to fragment shader
- [ ] Add sunrise and sunset behaviuor to the shader similar to original
- [ ] Include calculation of declination angle to offset the cosine wave based on location/time of year
- [ ] Refactor the code because the current stucture is difficult to work with