

// ----- Model -----

Tempo = $.Model.extend({
  defaults: {
    accuracy: 0
  , bpm: 0
  , latestTap: 0
  , previousTap: 0
  , intervalAvg: 0
  , intervalAvgDelta: 0
  }
, initialize: function () {
    // note that this isn't a proper attribute of the model
    // what we want to do is set up a Tap model, and make intervals a *collection*
    this.intervals = [];
  }
, addTap: function (timeStamp) {
    this.set('previousTap', this.get('latestTap'));
    this.set('latestTap', timeStamp);
    this.calculateTempo();
  }
, calculateTempo: function () {
    var delta
      , newBpmValue
      , newAccuracyValue
      , oldIntervalAvg;

    if (this.get('previousTap')) {
      delta = this.get('latestTap') - this.get('previousTap');

      // capture current intervalAvg
      oldIntervalAvg = this.getIntervalAvg();

      // add new interval
      this.intervals.push(delta);

      this.set('intervalAvg', this.getIntervalAvg());

      // difference between last two intervalAvg values
      if (oldIntervalAvg) {
        this.set('intervalAvgDelta', oldIntervalAvg - this.get('intervalAvg'));
      }

      console.log(this.get('intervalAvgDelta'));

    }
    // must have at least 4 taps (3 intervals) before setting a tempo value
    if (this.intervals.length > 2) {
      newBpmValue = (60000 / this.get('intervalAvg')).toFixed(1);
      this.set('bpm', newBpmValue);
      if ((this.intervals.length - 3) > 30) {
        newAccuracyValue = 100;
      } else {
        newAccuracyValue = Math.round(100 * ((this.intervals.length - 3) / 30));
      }
      this.set('accuracy', newAccuracyValue);
    }

  }
, getIntervalAvg: function () {
    return this.intervals.reduce(function(a, b) { return a + b; }, 0) / this.intervals.length;
  }
});



// ----- View -----

BPMPalette = $.View.extend({
  initialize: function () {

    this.tempo = new Tempo();
    this.tempo.on('change:accuracy', this.updateAccuracy, this);
    this.noValue = true;
    this.render();
    // listen for spacebar
    $('body').keydown(function (e, view) {
      if (e.keyCode === 32) {
        view.handleTap();
      }
    }, this);
  }
, render: function () {
    var template = $.template($('#bpmPalette').html(), {bpm: '---'});
    $('#main').append(template);
    $('#bpmCalculator').drag().container('#main').bind();
    $('#tapButton').on('mousedown', function (e, view) {
      view.handleTap();
      e.stop();
    }, this);
    this.display = $('#bpmDisplay');
    this.displayValue = $('#bpmValue');
    this.accuracyBar = $('#accuracy');
  }
  // sadly, backbone's event handler doesn't seem to provide a way to prevent propagation
  // so I have no way to prevent dragging the window when clicking on the button
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
      console.log('Resetting');
      this.noValue = true;
      this.display.addClass('noValue');
      this.displayValue.html('---');
      this.tempo = new Tempo();
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

    this.accuracyBar.css({
      'width': accuracy + '%'
    , 'background': '-webkit-linear-gradient(bottom, hsl(' + hue + ',60%,40%), hsl(' + hue + ',50%,65%) 100%)'
    });
  }
});


// ----- Startup -----

$.domReady(function () {
  var bpmPalette;
  bpmPalette = new BPMPalette({ el: '#bpmCalculator' });
});
