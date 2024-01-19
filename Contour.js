/**-
 * Copyright (c) 1986-2023 Richard K. Wright. All rights reserved.
 *
 * This work is licensed under the terms of the MIT license.
 * For a copy, see <https://opensource.org/licenses/MIT>.
 *
 * Contour.js
 *
 */

'use strict';

//--- Contour class constants ---
const DELTA_DIV = 10000;

const CLOCKWISE = 1
const CLOSED = 0;
const COUNTERCLOCKWISE = -1;

const MAX_LOOP_LIMIT = 255;

const HORIZONTAL = 0;
const VERTICAL = 1;

const LEFT_EDGE = 0;
const TOP_EDGE = 1;
const RIGHT_EDGE = 2;
const BOTTOM_EDGE = 3;

const xdirec = [ 1, 0, -1, 0 ];
const ydirec = [ 0, 1, 0, -1 ];
const nexd   = [ 1, 2, 3, 0 ];
const nsd    = [ 3, 0, 1, 2 ];
const id     = [ 2, 3, 0, 1 ];

/**
 *  Contour limits for a given cell,
 *
 */
class ContourLimit {
    topX = MAX_LOOP_LIMIT;	    //  limb 0, HORIZONTAL
    botX = MAX_LOOP_LIMIT;
    topY = MAX_LOOP_LIMIT;     // limb 1, VERTICAL
    botY = MAX_LOOP_LIMIT;
    CW0  = CLOSED; 		    // sign of slope of limb intersected by vector
    CW1  = CLOSED;
}

/**
 *
 */
class ContourVector {
    x = [];     // coordinate arrays
    y = [];

    stCW; 			   // sign of slope of start edge limb intersected by vector
    finCW; 			   // sign of slope of finish edge limb intersected by vector
    stEdge; 		   // edge number for start
    finEdge; 		   // edge number for finish
}

/**
 *
 */
class Contour {

    REVISION = '0.2.0';

    ns; 			// first index in X
    nf; 			// last index in X
    ms; 			// first index in Y
    mf; 			// last index in Y
    minZ;
    maxZ;
    nCont;			// number of contours to be found

    bounds         = [];    // 2x2 contouring limits for each cell - ContourLimits
    contourVectors = [];    // 1xN ContourVector
    contLevels     = [];    // 1xnCont float, contour limits

    /**
     *
     * @param array
     */
    setupContours( array ) {
       this.allocBounds ( array );
       this.setContLevels( array, 2.0 );
       this.initFlags( array );
    }

    /**
     *
     * @param array
     */
    allocBounds ( array ) {
        this.ns = 0;
        this.ms = 0;
        this.mf = array.length;
        this.nf = array[0].length;

        this.minZ = Number.MAX_VALUE;
        this.maxZ = -Number.MAX_VALUE;

        this.bounds = [];
        for ( let i = this.ms; i < this.mf; i++ ) {
            this.bounds[i] = [];
            for ( let j = this.ns; j < this.nf; j++ ) {
                this.bounds[i][j] = new ContourLimit();

                this.minZ = Math.min(this.minZ, array[i][j]);
                this.maxZ = Math.max(this.maxZ, array[i][j]);
            }
        }
    }

    /**
     *
     * @param array
     * @param contInterval
     */
    setContLevels ( array, contInterval ) {

        this.nCont = Math.ceil((this.maxZ - this.minZ) / contInterval);

        for ( let i = 0; i < this.nCont; i++ ) {
            this.contLevels.push(this.minZ + i * contInterval);
        }

        this.delta = (this.maxZ - this.minZ) / DELTA_DIV;
    }

    /**
     * Initialize the flag array, setting the upper and lower bounds
     * for the contours for each segment as well as the winding direction
     *
     * @param array
     */
    initFlags ( array ) {
        let u, v;
        let uplim = this.contLevels.length - 1;

        for ( let i = this.ms; i < this.mf; i++ ) {
            for ( let j = this.ns; j < this.nf; j++ ) {
                let bound = this.bounds[i][j];

                u = array[i][j];

                if (j < (this.nf - 1)) {
                    v = array[i][j+1];

                    // set the "slope" paramater
                    bound.CW0 = (v < u) ? COUNTERCLOCKWISE : CLOCKWISE;

                    let TB = this.getTB( v, u, uplim);

                    bound.topX = TB.t;
                    bound.botX = TB.b;
                }

                if (i < (this.mf - 1)) {
                    v = array[i+1][j];

                    // set the "slope" paramater
                    bound.CW1 = (v > u) ? COUNTERCLOCKWISE : CLOCKWISE;

                    let TB = this.getTB( v, u, uplim);

                    bound.topY = TB.t;
                    bound.botY = TB.b;
                }
            }
        }

        // DEBUG: Dump contents of Bounds
        for ( let i = this.ms; i < this.mf; i++ ) {
            for ( let j = this.ns; j < this.nf; j++ ) {
                console.log("i: " + i + " j: " + j + " Bounds: " + JSON.stringify(this.bounds[i][j] ));
            }
        }
    }

    /**
     * Get the top and bottom contour limits relative to the current data point
     *
     * @param v
     * @param u
     * @param uplim
     */
    getTB ( v, u, uplim ) {
        if (v > u) [v,u] = [u,v];

        let t = uplim;
        while (t > 0 && this.contLevels[t] > u) t--;

        let b = 0;
        while (b <= t && this.contLevels[b] <= v) b++;

        return { t:t, b:b }
    }

    /**
     * This threads a single contour level through the supplied data-set.
     *
     * @param array             the data array itself
     * @param contourNum        index of level of Contour
     * @param contourLevel      actual level of Contour
     * @return
     */
    threadContour ( array,
                    contourNum,
                    contourLevel ) {

        let bExit = false;
        let bStart = true;
        let bEdg = true;
        let bInRange = true;
        let bCont = false;
        let dt = 0;
        let d0 = 0;
        let direc = 0;
        let lmb = 0;
        let x0 = 0;
        let x1 = this.ns;
        let x2 = 0;
        let y0 = 0;
        let y1 = this.ms;
        let y2 = 0;
        let ccwknt = 0;
        let ccwval = 0;
        let bound = null;

        let contVec = new ContourVector ();
        let self = this;

        while (!bExit) {
            bInRange = inRange();

            if (bInRange) {

                bCont = checkCont();

                if ( bCont )
                    addNewPoint();
            }

            if (bStart)
                handleStart();
            else
                if (bInRange)
                    handleNav();
                else
                    handleEdge();
        }

        /*--------- sub-functions ---------------------*/
        /**
         * Checks if the current search-cell is in range
         *
         * @returns {boolean}
         */
        function inRange  () {
            console.log("Next Edge: < " + x1 + ", " + y1 + " >  < " +
                               (x1 + xdirec[direc]) + ", " + (y1 + ydirec[direc]) + " >" );

            x2 = x1 + xdirec[direc];
            if (x2 >= self.ns && x2 < self.nf) {
                y2 = y1 + ydirec[direc];
                if (y2 >= self.ms && y2 < self.mf) {
                    console.log("True");
                    return true;
                }
            }

            console.log("False");
            return false
        }

        /**
         * Check if the current cell-limbs intersect the current level
         *
         */
        function checkCont () {
            let xlmb,ylmb;

            if (x1 === x2) {
                lmb = VERTICAL;
                xlmb = x1;
                ylmb = (y2 > y1) ? y1 : y2;
                bound = self.bounds[ylmb][xlmb];
                return bound.botY === contourNum;
            } else {
                lmb = HORIZONTAL;
                ylmb = y1;
                xlmb = (x2 > x1) ? x1 : x2;
                bound = self.bounds[ylmb][xlmb];
                return bound.botX === contourNum;
            }
        }

        /**
         * Given the geometry, calculate the intercept
         *
         */
        function addNewPoint () {
            let m1 = array[y1][x1];
            let m2 = array[y2][x2];
            let tt;

            if (Math.abs(contourLevel - m1) <= self.delta)
                m1 += ((m2 > m1) ? self.delta : -self.delta);

            if (Math.abs(contourLevel - m2) <= self.delta)
                m2 += ((m1 > m2) ? self.delta : -self.delta);

            if (Math.abs(m2 - m1) < Number.MIN_VALUE)
                tt = 0.0;   // skip calculating to avoid divide-by-zero
            else
                tt = (contourLevel - m1) / (m2 - m1);

            if (Math.abs(tt) >= 1.0)
                tt = (1.0 - self.delta) * Math.fpSign(tt);

            let u = (x2 - x1) * tt + x1;
            let v = (y2 - y1) * tt + y1;

            // store the result
            contVec.x.push(u);
            contVec.y.push(v);

            console.warn("Found result: " + (contVec.x.length-1) + " : " + u.toFixed(2) + "  " +
                v.toFixed(2) + " for level: " + contourLevel);

            // if the first elm, then set the entry slope value. Note that we have to d
            // etermine which direction we are passing through the limb.
            if (contVec.x.length === 1) {
                if (lmb === HORIZONTAL)
                    ccwval = ((contVec.x[0] > 0) ? -bound.CW0 : bound.CW0);
                else
                    ccwval = ((contVec.y[0] > 0) ? -bound.CW1 : bound.CW1)

                contVec.stCW = ccwval;
                //contVec.stEdge = findEdge(contVec.x[0], contVec.y[0], 2, 2);
            }

            ccwknt += ccwval;

            // mark this seg as "used"
            if (lmb === VERTICAL)
                bound.botY++;
            else
                bound.botX++;
        }

        /**
         * Update the navigation info
         *
         */
        function handleNav () {

             if (bCont) {

                dt = id[direc];
                direc = nsd[direc];

            } else {
                        /* no contours found... */
                direc = nexd[direc];
                if (direc === dt) {
                    //  back going in same dir no contour found, it must
                    //  be closed, so dup ends so curve closes

                    contVec.x.push(contVec.x[0]);
                    contVec.y.push(contVec.y[0]);

                    console.warn("Closed cont, duped end: " + (contVec.x.length - 1) + ": " +
                        contVec.x[0] + " " + contVec.y[0]);

                    // signal that this is closed and set the direction flag
                    contVec.stCW = CLOSED;
                    contVec.finCW = (ccwknt < 0) ? COUNTERCLOCKWISE : CLOCKWISE;
                    ccwknt = 0;

                    self.contourVectors.push(contVec);

                    contVec = newContVec();

                } else {
                    x1 = x2;
                    y1 = y2;
                }
            }
        }

        /**
         * Set up a new ContVec
         */
        function newContVec() {
            let cVec = new ContourVector();
            direc = d0;
            x1 = x0 + xdirec[direc];
            y1 = y0 + ydirec[direc];
            cVec.finCW = CLOSED;
            bStart = true;

            return cVec
        }

        /**
         *  We've reached the edge, so we need to figure out what the slope is
         *  of the limb we are exiting through.
         *  Note that we also have to determine which direction we are passing
         *  through the limb.
         *
         */
        function handleEdge () {

            let vecTop = contVec.x.length;
            if (lmb === HORIZONTAL)
                contVec.finCW = ((contVec.x[vecTop - 1] < contVec.x[vecTop - 2]) ?
                    -bound.CW0 : bound.CW0);
            else
                contVec.finCW = ((contVec.y[vecTop - 1] < contVec.y[vecTop - 2]) ?
                    -bound.CW1 : bound.CW1);

            contVec.finEdge = findEdge(contVec.x[vecTop - 1], contVec.y[vecTop - 1], self.mf-1, self.nf-1);

            self.contourVectors.push(contVec);

            console.warn("Saved new path: ");
            for ( let a= 0; a<contVec.x.length; a++ ) {
                console.warn(a + ": " + contVec.x[a] + ", " + contVec.y[a]);
            }

            contVec = newContVec();
        }

        /**
         *
         */
        function handleStart () {
            if (bInRange) {
                if (bCont) {
                    // found a contour, this is first cell, so save  current cell coords, direction
                    x0 = x1;
                    y0 = y1;
                    d0 = direc;
                    x1 = x2;
                    y1 = y2;
                    dt = direc;
    
                    bStart = false;
    
                    direc = nexd[direc];
                } else {
                    x1 = x2;
                    y1 = y2;
                }
            } else {  /* out of range... */
    
                if (bEdg) {
                    if (y2 < self.ms) {
                        x1 = self.ns;
                        y1 = self.ms + 1;
                        direc = 0;
                        bEdg = false;
                    } else
                        direc = nexd[direc];
                } else {
                    if (direc === 1) {
                        y1 = self.ms;
                        x1++;
                        bExit = (x1 >= self.nf);
                    } else {
                        y1++;
                        x1 = self.ns;
                        if (y1 >= self.mf) {
                            x1 = self.ns + 1;
                            y1 = self.ms;
                            direc = 1;
                        }
                    }
                }
            }
        }

        /**
         *
         * @param x
         * @param y
         * @param xmax
         * @param ymax
         * @returns {number}
         */
        function findEdge ( x, y, xmax, ymax ) {
            let edg = LEFT_EDGE;

            if (Math.fpNear(x, xmax))
                edg = RIGHT_EDGE;
            else if (Math.fpNear(y, ymax))
                edg = TOP_EDGE;
            else if (Math.fpNear(y, 0))
                edg = BOTTOM_EDGE;

            return edg;
        }

        //---------------- end of sub-functions in ThreadContour -----------------
    }
}
