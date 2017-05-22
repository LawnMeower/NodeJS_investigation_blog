const express = require('express'),
    router = express.Router(),
    data = require('../dataAccessLayer');

module.exports = function (passport) {

    router.get('/', (req, res) => {
        res.render('index');
    });

    router.get('/login', (req, res) => {
        res.render('login');
    })

    router.get('/profile', (req, res) => {
        data
            .getProfileInfo()
            .then((profileInfo) => {
                res.render('profile', profileInfo);
            })
    });

    router.get('/profile/post/:id', (req, res) => {
        data
            .getPostById(req.params.id)
            .then((postInfo) => {
                res.render('post', postInfo);
            })
    });

    router.post('/profile/post/:id/newComment', (req, res) => {
        data
            .addCommentToThePost(req.body.comment, req.query.ownerId, req.query.detailId)
            .then(() => {
                res.redirect('../' + req.params.id + '?userId=' + global.User.id);
            })
    })

    router.post('/profile/post/:id/rate', (req, res) => {
        data
            .setRateToThePost(req.body.rating, req.params.id, req.query.ownerId)
            .then(() => {
                res.redirect('../' + req.params.id + '?userId=' + global.User.id);
            });

    })

    router.get('/profile/newPost', (req, res) => {
        res.render('newPost');
    });

    router.post('/profile/newPost', (req, res) => {
        data
            .addPost(req.body.title, req.body.content)
            .then(() => {
                res.redirect('/profile');
            })
    });

    router.post('/login', passport.authenticate('local', {
        session: true,
        successRedirect: '/profile',
        failureRedirect: '/'
    }));

    router.get('/login/facebook', passport.authenticate('facebook', {scope: 'email'}));

    router.get('/login/facebook/callback', passport.authenticate('facebook', {
        successRedirect: '/profile',
        failureRedirect: '/'
    }));

    router.get('/logout', (req, res) => {
        req.logout();
        res.redirect('/');
    });

    return router;
}
