'use strict';

const router = require('koa-router')();
const mount = require('koa-mount');
const koaBody = require('koa-body')();
const methods = require('./methods');
const settings = require('./settings');
const auth = require('koa-basic-auth')({ name: settings.apUser, pass: settings.apPass });
const theme = new require('./themes')(settings.theme);

router.use(function *(next){
    try {
        yield next;
    } catch (err) {
        if (401 == err.status) {
            this.status = 401;
            this.set('WWW-Authenticate', 'Basic');
            this.body = 'nah mane';
        } else {
            throw err;
        }
    }
});

router.use(function *(next){
    let playlist = yield methods.getPlaylist();
    let queue = yield methods.getQueue();

    // Set locals
    this.locals = {
        renderData: {
            settings: settings,
            themeSettings: theme._settings,
            themeFn: theme._fn,
            buildMeta: methods.buildMeta,
            playlist: playlist,
            queue: queue,
            song: undefined,
            episode: undefined,
            success: undefined,
            error: undefined
        }
    };
    yield next;
});

/* GET playlist. */
router.get('/playlist', function *(next) {
    this.set('Content-Type', 'application/json');
    this.body = JSON.stringify(this.locals.renderData.playlist);
});
/* Post new song */
router.post(settings.apRoute, koaBody, auth, function *(next) {
    if(this.request.body.deleteID){
        let res = yield methods.delete(this.request.body.deleteID);
        if (typeof(res) === 'string') {
            this.locals.renderData.error = res;
        } else {
            let song = res;
            this.locals.renderData.success = 'Deleted '+song.title+' by '+song.artist+' successfully from queue.';
        }
    }
    else if(this.request.body.publishID){
        let res = yield methods.publish(this.request.body.publishID);
        if (typeof(res) === 'string') {
            this.locals.renderData.error = res;
        } else {
            let song = res;
            this.locals.renderData.success = 'Published '+song.title+' by '+song.artist+' as episode '+song.episode+'.';
        }
    }
    else{
        let song = {
            title: this.request.body.title,
            artist: this.request.body.artist,
            album: this.request.body.album,
            url: this.request.body.url
        }

        if((typeof(song.title)==='string' && song.title.length > 0)
        &&(typeof(song.artist)==='string' && song.artist.length > 0)
        &&(typeof(song.album)==='string' && song.album.length > 0)
        &&(typeof(song.url)==='string' && song.url.length > 0)){
            let res = yield methods.save(song);
            if (typeof(res) === 'string') {
                this.locals.renderData.error = res;
                this.locals.renderData.song = song;
            } else {
                this.locals.renderData.success = 'Saved '+song.title+' by '+song.artist+'.';
            }
        }
        else{
            this.locals.renderData.error = 'Missing or bad input.';
            this.locals.renderData.song = song;
        }
    }
    yield next;
});

/* GET adminpanel. */
router.all(settings.apRoute, auth, function *(next) {
    this.body = yield this.render('ap', this.locals.renderData);
});

/* GET home page. */
router.get('/', function *(next) {
    let episode = playlist[0];
    episode.isHome = true;
    this.locals.renderData.episode = episode;
    this.body = yield this.render('index', this.locals.renderData);
});

/* GET episode */
router.get('/:id', function *(next) {
    let episode = this.params.id;
    let playlist = this.locals.renderData.playlist;
    episode = methods.findEpisodeInPlaylist(episode, playlist);

    if (!episode) {
        this.redirect('/');
    }

    this.locals.renderData.episode = episode;
    this.body = yield this.render('index', this.locals.renderData);
});

module.exports = router;
