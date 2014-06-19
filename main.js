// catch all errors with no handler
process.on('uncaughtException', function (err) {
    console.log('Caught exception without specific handler: ' + util.inspect(err));
    console.log(err.stack, 'error');
    process.exit(1);
});

// dependencies
var fs = require('fs');
var request = require('request');
var avconv = require('avconv');
var mm = require('musicmetadata');
var util = require('util');
var exec = require('child_process').exec;
var pifm;

// Song source
function Source (list) {
    this.list = list;
};

// fetch a song
Source.prototype.fetch = function (callback) {
    callback(null, this.list.shift());
};

// add a song
Source.prototype.add = function (url) {
    this.list.push(url);
};

// The radio player
function Player (source, params, tempInput, tempOutput) {
    this.source = source;
    this.params = params;
    this.tempInput = tempInput;
    this.tempOutput = tempOutput;
};

// play a song
Player.prototype.play = function (stream) {
    // When the conversion finishes, start the broadcasting
    stream.once('exit', function (exitCode, signal) {
        pifm = exec('./pifm ' + this.tempOutput + ' 103.0 44100 stereo', function (error, stdout, stderr) {
            if (error !== null) {
                console.log('exec error: ' + error);
            }

            console.log('finished playing the song - skipping to next in queue');

            stream = null;
            this.next() // - download, convert and play the next song
        }.bind(this));

        console.log('finished converting file');
        console.log('playing it on radio!');

        // get meta and print it
        this.publishData(meta);

    }.bind(this));

    // get meta data
    stream.on('meta', function (meta) {
        console.log('found meta data:');
        console.log(util.inspect(meta));
    });

    // get progress
    stream.on('meta', function (progress) {
        console.log('progress: ');
        console.log(util.inspect(progress));
    });
}

// publish meta data
Player.prototype.publishData = function (file) {
    // create a new parser from a node ReadStream
    var parser = mm(file);

    // listen for the metadata event
    parser.on('metadata', function (result) {
        console.log('playing : ' + result.artist + ' - ' + result.title);
        // console.log(result);
    });
}

// convert a song
Player.prototype.convert = function (url) {
    console.log('converting....')

    var input = fs.createReadStream(this.tempInput);
    var meta = fs.createReadStream(this.tempInput);
    var stream = avconv(this.params);

    this.play(stream, meta);

    input.pipe(stream);
};

// download a song
Player.prototype.download = function (url) {
    console.log('downloading....');

    var output = fs.createWriteStream(this.tempInput);

    output.on('finish', function () {
        console.log('finished saving file');
        this.convert()
    }.bind(this));

    var req = request(url).pipe(output);

    req.on('close', function () {
        console.log('finished downloading');
    });
};

// play next song
Player.prototype.next = function () {
    this.source.fetch(function (err, song) {
        if(err || !song) {
            console.log('no songs in queue - waiting..');
            setTimeout(this.next.bind(this), 2000);
        }
        else {
            console.log('found song...')
            this.download(song);
        }
    }.bind(this));
}

// source instance
var source = new Source([
    'https://www.dropbox.com/s/yvewndl6pl5d78k/11%20-%20Kings%20Of%20Leon%20-%20On%20The%20Chin.mp3?dl=1'
]);

// avconv params
var params = [
    '-i', 'pipe:0',         // Tell avconv to expect an input stream (via its stdin) - use request to fetch mp3 or video
    '-acodec', 'pcm_s16le',
    '-ac', '2',             // The number of channels
    '-ar', '44100',         // sample rate
    '-aq', '9',             // quality
    '-y',                   // overwrite output file if it exists
    '-f', 'wav',            // We want wav out from the converter
    'tempoutput.wav'        // Tell avconv to stream the converted data (via its stdout)
];

// player instance
var player = new Player(source, params, 'tempinput', 'tempoutput.wav');

// start player
player.next();

// add another song to queue after 2 sec
setTimeout(function () {
    source.add('https://www.dropbox.com/s/9xabf9oflrvyda4/06%20-%20Kings%20Of%20Leon%20-%20Wait%20for%20Me.mp3?dl=1');
}.bind(this), 2000);

// add another song to queue after 5 sec
setTimeout(function () {
    source.add('https://www.dropbox.com/s/2yw1eelgj13l3b8/04%20-%20Kings%20Of%20Leon%20-%20Beautiful%20War.mp3?dl=1');
}.bind(this), 5000);

