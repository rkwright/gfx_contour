/**
 *
 */

'use strict';

/**
 * Constants
 */
class Contour  {

    //--- constants ---
    REVISION = '0.1.0';

    //--- class methods ---
    constructor () {
    }

    SetUp ( array ) {

        console.log("Setting up Contour. Array size: " + array.length + " subLen: " +  array[0].length);
    }

    ThreadContours ( array,  contLevel ) {

        console.log("Threading Contour. Array size: " + array.length +
                            "  contour level: " + contLevel.toFixed(1));

    }
}

