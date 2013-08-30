/*
TODO

Accuracy Reading
- Look at BPM Grapher and see how it measures accuracy (not sure if it does, actually)
- Ignore outliers
  - if tap is early or late beyond some threshold, don't push the interval
  - one bad tap could actually generate *two* bad intervals, but the right threshold should catch both
- Account for missed taps (interval is roughly double the average)

UI
- Make the outline of the display pulse at the displayed tempo
- Flash the button when pressing spacebar
- Add a checkbox for "display decimal point"; off by default; toggles rounding of displayed tempo
*/


// ----- Model -----

/*
- intervals is just a direct property instead of a model attribute; doesn't seem worth the overhead to make a collection for a simple array of integers (no real benefit)
- not taking advantage of the KVO stuff yet
*/

Tempo = $.Model.extend({
  defaults: {
    accuracy: 0
  , bpm: 0
  , latestTap: 0
  , previousTap: 0
  , intervalAvg: 0
  }
, initialize: function () {
    this.intervals = [];
  }
, addTap: function (timeStamp) {
    this.set('previousTap', this.get('latestTap'));
    this.set('latestTap', timeStamp);
    this.calculateTempo();
  }
, calculateTempo: function () {
    var interval
      , previousInterval
      , intervalAvgDelta
      , newAccuracyValue
      , newBpmValue
      , previousIntervalAvg
      , log = [];

    if (this.get('previousTap')) {

      interval = this.get('latestTap') - this.get('previousTap');

      if (this.get('previousInterval')) {
        previousInterval = interval - this.get('previousInterval');
      }

      this.set('previousInterval', interval);

      // capture current intervalAvg
      previousIntervalAvg = this.getIntervalAvg();

      // add new interval (ms between last tap and current tap)
      this.intervals.push(interval);

      this.set('intervalAvg', this.getIntervalAvg());

      // difference between last two intervalAvg values
      if (previousIntervalAvg) {
        intervalAvgDelta = (this.get('intervalAvg') - previousIntervalAvg).toFixed(3);

        log.push(this.pad(this.intervals.length + 1,3,0));
        log.push(this.pad(interval,8,' '));
        log.push(this.pad(previousInterval,8,' '));
        log.push(this.pad(this.get('intervalAvg').toFixed(3),8,' '));
        log.push(this.pad(intervalAvgDelta > 0 ? '+' + intervalAvgDelta : intervalAvgDelta,8,' '));
        log.push(this.pad(this.median(),8,' '));
        console.log(log.join(' '));
      } else {

        log.push(this.pad(this.intervals.length + 1,3,0));
        log.push(this.pad(interval,8,' '));
        log.push('       -');
        log.push(this.pad(this.get('intervalAvg').toFixed(3),8,' '));
        log.push('       -');
        log.push('       -');
        console.log(log.join(' '));
      }

    } else {
      console.log(this.pad(this.intervals.length + 1,3,0) + '        -        -        -        -        -');
    }

    // must have at least 4 taps (3 intervals) before setting a tempo value
    if (this.intervals.length > 2) {
      newBpmValue = (60000 / this.get('intervalAvg')).toFixed(0);
      this.set('bpm', newBpmValue);
/*
- accuracy isn't a real measure of decreasing deviation yet (will be eventually)
- for now it just counts to 30 intervals, which is usually enough to get a good reading, but only if the taps were steady (none were missed or late/early)
*/
      if ((this.intervals.length - 3) > 30) {
        newAccuracyValue = 100;
      } else {
        newAccuracyValue = Math.round(100 * ((this.intervals.length - 3) / 30));
      }
      this.set('accuracy', newAccuracyValue);
    }

  }
  // median gets close to the correct value very quickly
, median: function () {
    var m1
      , m2
      , is = this.intervals.sort();

    if (this.intervals.length % 2 === 0) {
      // even number
      m1 = this.intervals.length / 2;
      m2 = m1 - 1;
      return (is[m1] + is[m2]) / 2;
    }

    // ugly floating point workaround
    m1 = (this.intervals.length / 2 * 10 - 5) / 10;

    return is[m1];
  }
, getIntervalAvg: function () {
    return this.intervals.reduce(function(a, b) { return a + b; }, 0) / this.intervals.length;
  }
, pad: function (n, width, z) {
    z = z || '0';
    n = n + '';
    return n.length >= width ? n : new Array(width - n.length + 1).join(z) + n;
  }
});



// ----- View -----

BPMPalette = $.View.extend({
  initialize: function () {

    this.tempo = new Tempo();
    this.tempo.on('change:accuracy', this.updateAccuracy, this);
    this.noValue = true;
    this.render();
  }
, render: function () {
    var template = $.template($('#bpmPalette').html(), {bpm: '---'});
    $('#main').append(template);

    this.display = $('#bpmDisplay');
    this.displayValue = $('#bpmValue');
    this.accuracyBar = $('#accuracy');

    // ----- Event Handlers -----

    // button click
    $('#tapButton').on('mousedown', function (e, view) {
      view.handleTap();
      e.stop();
    }, this);
    // let spacebar trigger the button
    $('body').keydown(function (e, view) {
      if (e.keyCode === 32) {
        view.handleTap();
      }
    }, this);
    // enable dragging the "window"
    $('#bpmCalculator').drag().container('#main').bind();
  }
/*
- Backbone's built-in event handler doesn't seem to provide a way to stop propagation, so there's no way to prevent dragging the "window" when clicking on the button
- Using Bean for event registration instead
*/
// , events: {
//     'mousedown #tapButton': 'handletap'
//   }
, handleKeyDown: function (e) {
    if (e.keyCode === 32) {
      this.handleTap();
    }
  }
, handleTap: function (e) {
    var timeStamp = Date.now();

    if (timeStamp - this.tempo.get('latestTap') >= 2500) {
      console.log('\nNew tempo measurement started (all values in ms)\n');
      console.log('tap interval    int ∆  avg int    avg ∆   median');
      console.log('--- -------- -------- -------- -------- --------');
      this.noValue = true;
      this.display.addClass('noValue');
      this.displayValue.html('---');
      window.tempo = this.tempo = new Tempo();
      this.tempo.on('change:accuracy', this.updateAccuracy, this);
      this.updateAccuracy();
    }

    this.tempo.addTap(timeStamp);
    if (this.tempo.get('bpm')) {
      if (this.noValue) {
        this.noValue = false;
        this.display.removeClass('noValue');
      }
      this.updateDisplay();
    }
  }
, updateDisplay: function () {
    this.displayValue.html(this.tempo.get('bpm').toString());
  }
, updateAccuracy: function () {
    var accuracy = this.tempo.get('accuracy')
      , hue = Math.round(40 + (80 * (accuracy / 100)));

    // TODO: In order to do cross-browser gradient support for the accuracy bar, I'll need to define a series of classes for the hue sequence (maybe 10 levels?) and use a class instead of setting the background property directly. Need to test with various levels of granularity and settle on the fewest number of classes needed to make the hue transition appear smooth.
    this.accuracyBar.css({
      'width': accuracy + '%'
    , 'background': 'linear-gradient(-180deg, hsl(' + hue + ',50%,65%) 0%, hsl(' + hue + ',60%,40%) 100%)'
    , 'border': '1px solid hsl(' + hue + ',60%,30%)'
    });
  }
});

// ----- Startup -----

$.domReady(function () {
  window.bpmPalette = new BPMPalette({ el: '#bpmCalculator' });
});
