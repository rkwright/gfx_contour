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

//const TOP_BOT_EDGE = 1;		// if edg & this, then TOP or BOTTOM

const EPSILON = 0.0005;

const xdirec = [ 1, 0, -1, 0 ];
const ydirec = [ 0, 1, 0, -1 ];
const nexd = [ 1, 2, 3, 0 ];
const nsd = [ 3, 0, 1, 2 ];
const id = [ 2, 3, 0, 1 ];

/**
 *
 *
 */
class ContourLimit {
    top0 = MAX_LOOP_LIMIT;	 	// Contour limits for a given cell, limb 0
    bot0 = MAX_LOOP_LIMIT;
    top1 = MAX_LOOP_LIMIT;
    bot1 = MAX_LOOP_LIMIT;
    CW0  = CLOSED; 		   // sign of slope of limb intersected by vector
    CW1  = CLOSED;
}

/**
 *
 *  This class defines the upper and lower limits of the contours for each
 *   cell, where
 *                              for a given cell, whose actual data point
 *                              is represented by the '*'
 *          l   +------+        limb = 1 is the left-side of the cell,
 *     ^    i   |      |        limb = 0 is the bottom of the cell
 *     |    m   |      |
 *   incr   b   |      |
 *     Y    1   *------+
 *               limb = 0
 *
 *           --> increasing x
 *
 *  Note on the slope parameter:  the parm represents the sign of the
 *  slope along the direction of travel for the vector, where it
 *  it intersects the edge:
 *		 not edge             = 0,
 *		 higher elev to right = +1  ->   clockwise
 *		 higher elev to left  = -1	->   counterclockwise
 *
 *  hence if one goes clockwise, the higher elev will be encircled.
 */
class ContourVector {
    x = [];  // coordinate arrays
    y = [];

    elmKnt;         // number of elms in the coordinate array
    stCW; 			// sign of slope of start edge limb intersected by vector
    finCW; 			// sign of slope of finish edge limb intersected by vector
    stEdge; 		// edge number for start
    finEdge; 		// edge number for finish
}

/**
 *
 */
class Contour {

    //--- constants ---
    REVISION = '0.2.0';

    ns; 			// first index in X
    nf; 			// last index in X
    ms; 			// first index in Y
    mf; 			// last index in Y
    minZ;
    maxZ;
    nCont;			// number of contours to be found

    bounds = [];            // contouring limits for each cell - ContourLimits
    contourVectors = [];    // ContourVector
    contLevels = [];        // float, contour limits

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
        let t, b;
        let u, v;
        let uplim = this.contLevels.length - 1;

        for ( let i = this.ms; i < this.mf; i++ ) {
            for ( let j = this.ns; j < this.nf; j++ ) {
                let bound = this.bounds[i][j];

                u = array[i][j];

                if (j < (this.nf - 1)) {
                    v = array[i][j+1];

                    //  Here we set the slope-sign for this horizontal segment.
                    //  We set it in terms of the X-direction vector which will intersect
                    //  this edge when the vector is going in the direction of increasing X. It
                    //  will have the opposite sign if the vector is going in the direction
                    //  of decreasing X
                    bound.CW0 = (v < u) ? COUNTERCLOCKWISE : CLOCKWISE;

                    let TB = this.getTB( v, u, uplim);

                    bound.top0 = TB.t;
                    bound.bot0 = TB.b;
                }

                if (i < (this.mf - 1)) {
                    v = array[i+1][j];

                    // Now we set the slope-sign for this vertical segment.  We set
                    // it for the vector that will intersect this edge when the
                    // vector is going in the direction of increasing Y. It will
                    // have the opposite sign if the vector is moving in
                    // the direction of decreasing Y.
                    bound.CW1 = (v > u) ? COUNTERCLOCKWISE : CLOCKWISE;

                    let TB = this.getTB( v, u, uplim);

                    bound.top1 = TB.t;
                    bound.bot1 = TB.b;
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

        let t,b;
        if (v > u) {
            t = uplim;
            while (t > 0 && this.contLevels[t] > v) t--;

            b = 0;
            while (b <= t && this.contLevels[b] <= u) b++;
        } else {
            t = uplim;
            while (t > 0 && this.contLevels[t] > u) t--;

            b = 0;
            while (b <= t && this.contLevels[b] <= v) b++;
        }

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
        let xmax = this.nf - 1.0;
        let ymax = this.mf - 1.0;
        let vecTop = 0;
        let x0 = 0;
        let x1 = this.ns;
        let x2 = 0;
        let xlmb = 0;
        let y0 = 0;
        let y1 = this.ms;
        let y2 = 0;
        let ylmb = 0;
        let u, v, tt;
        let m1, m2;
        let ccwknt = 0;
        let ccwval = 0;
        let delt;
        let bound = null;

        let contVec = new ContourVector ();
        let self = this;

        while (!bExit) {
            bInRange = inRange();

            console.log("bInRange: " + bInRange);

            if (bInRange) {     	/* set xlmb,ylmb vars */

                bCont = false;

                if (x1 === x2) {
                    lmb = VERTICAL;
                    xlmb = x2;
                    ylmb = (y2 > y1) ? y1 : y2;
                    bound = this.bounds[ylmb][xlmb];
                    bCont = bound.bot1 === contourNum;
                } else {
                    lmb = HORIZONTAL;
                    ylmb = y1;
                    xlmb = (x2 > x1) ? x1 : x2;
                    bound = this.bounds[ylmb][xlmb];
                    bCont = bound.bot0 === contourNum;
                }

                console.log("x1,y1: " + x1 + ", " + y1 + " x2,y2: " + x2 + ", " + y2 +  " bCont: " + bCont);

                // if there is one, then find it
                if (bCont) {
                    m1 = array[y1][x1];
                    m2 = array[y2][x2];

                    if (Math.abs(contourLevel - m1) <= this.delta)
                        m1 += ((m2 > m1) ? this.delta : -this.delta);

                    if (Math.abs(contourLevel - m2) <= this.delta)
                        m2 += ((m1 > m2) ? this.delta : -this.delta);

                    if (Math.abs(m2 - m1) < Number.MIN_VALUE)
                        tt = 0.0;
                    else
                        tt = (contourLevel - m1) / (m2 - m1);

                    if (Math.abs(tt) >= 1.0)
                        tt = (1.0 - this.delta) * this.fpsign(tt);

                    u = (x2 - x1) * tt + x1;
                    v = (y2 - y1) * tt + y1;

                    // store the result
                    contVec.x.push(u);
                    contVec.y.push(v);
                    vecTop++;

                    console.warn("Found result: " + (vecTop-1) + " : " + u.toFixed(2) + "  " +
                                                  v.toFixed(2) + " for level: " + contourLevel);

                    // if the first elm, then set the entry slope value.
                    // Note that we have to determine which direction we
                    // are passing through the limb.
                    if (vecTop === 1) {
                        if (lmb === HORIZONTAL)
                            ccwval = ((contVec.x[0] > 0) ? -bound.CW0 : bound.CW0);
                        else
                            ccwval = ((contVec.y[0] > 0) ? -bound.CW1 : bound.CW1)

                        contVec.stCW = ccwval;
                        contVec.stEdge = this.FindEdge(contVec.x[0], contVec.y[0], xmax, ymax);
                    }

                    ccwknt += ccwval;

                    // mark this seg as "used"
                    if (lmb !== HORIZONTAL) {
                        bound.bot1++;
                        if (bound.bot1 > bound.top1)
                            bound.bot1 = MAX_LOOP_LIMIT;
                    } else {
                        bound.bot0++;

                        if (bound.bot0 > bound.top0)
                            bound.bot0 = MAX_LOOP_LIMIT;
                    }
                }
            }

            if (!bStart) {
                if (bInRange) {
                    if (bCont) {
                        dt = id[direc];
                        direc = nsd[direc];
                    } else {  /* no contours found... */
                        direc = nexd[direc];
                        if (direc === dt) {
                            //  back going in same dir no contour found, it must
                            //  be closed, so dup ends so curve closes

                            // save the point
                            contVec.x.push(contVec.x[0]);
                            contVec.y.push(contVec.y[0]);
                            vecTop++;

                            console.log("Closed cont, duped end: " + (vecTop-1) + ": " + contVec.x[0] + " " + contVec.y[0]);

                            // signal that this is closed and set the direction flag
                            contVec.stCW = CLOSED;
                            contVec.finCW = (ccwknt < 0) ? COUNTERCLOCKWISE : CLOCKWISE;
                            ccwknt = 0;

                            this.contourVectors.push(contVec);

                            vecTop = 0;
                            contVec = new ContourVector();

                            // go back to where last Contour started and begin again
                            direc = d0;
                            x1 = x0 + xdirec[direc];
                            y1 = y0 + ydirec[direc];
                            bStart = true;

                            contVec.finCW = CLOSED;
                        } else {
                            x1 = x2;
                            y1 = y2;
                        }
                    }   //cont false
                } else {  /* out of range... */
                    /*
                     *	We've reached the edge, so we need to figure out what
                     *  the slope is of the limb we are exiting through.
                     *  Note that we have to determine which direction we
                     *  we are passing through the limb.
                     */
                    if (lmb === HORIZONTAL)
                        contVec.finCW = ((contVec.x[vecTop - 1] < contVec.x[vecTop - 2]) ?
                            -bound.CW0 : bound.CW0);
                    else
                        contVec.finCW = ((contVec.y[vecTop - 1] < contVec.y[vecTop - 2]) ?
                            -bound.CW1 : bound.CW1);

                    contVec.finEdge = this.FindEdge(contVec.x[vecTop - 1], contVec.y[vecTop - 1], xmax, ymax);

                    this.contourVectors.push(contVec);

                    vecTop = 0;
                    contVec = new ContourVector();

                    direc = d0;

                    x1 = x0 + xdirec[direc];
                    y1 = y0 + ydirec[direc];

                    bStart = true;

                    contVec.finCW = CLOSED;
                }
            }     /* end of if !bStart */
            else {
                /* if bStart */
                if (bInRange) {
                    if (bCont) {
                        // found a contour, this is first cell, so
                        // save  current cell coords, direction

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
                        if (y2 < this.ms) {
                            x1 = this.ns;
                            y1 = this.ms + 1;
                            direc = 0;
                            bEdg = false;
                        } else
                            direc = nexd[direc];
                    } else {
                        if (direc === 1) {
                            y1 = this.ms;
                            x1++;
                            bExit = (x1 >= this.nf);
                        } else {
                            y1++;
                            x1 = this.ns;
                            if (y1 >= this.mf) {
                                x1 = this.ns + 1;
                                y1 = this.ms;
                                direc = 1;
                            }
                        }
                    }
                }
            }    // elseif bStart

        }	// while

        /**
         * Checks if the current search-cell is in range
         *
         * @returns {boolean}
         */
        function inRange  () {
            x2 = x1 + xdirec[direc];
            if (x2 >= self.ns && x2 < self.nf) {
                y2 = y1 + ydirec[direc];
                if (y2 >= self.ms && y2 < self.mf)
                    return true;
            }

            return false
        }
    }

    /**
     *
     * @param x
     * @param y
     * @param xmax
     * @param ymax
     * @return
     */
    FindEdge ( x, y, xmax, ymax ) {
        let edg = LEFT_EDGE;

        if (this.fpnear(x, xmax))
            edg = RIGHT_EDGE;
        else if (this.fpnear(y, ymax))
            edg = TOP_EDGE;
        else if (this.fpnear(y, 0))
            edg = BOTTOM_EDGE;

        return edg;
    }

    /**
     *
     * @param arg
     * @return
     */
    fpsign(arg) {
        return (arg < 0.0) ? -1.0 : 1.0;
    }

    /**
     *
     * @param a
     * @param b
     * @return
     */
    fpnear(a, b) {
        return (Math.abs(a - b) < EPSILON);
    }
}



