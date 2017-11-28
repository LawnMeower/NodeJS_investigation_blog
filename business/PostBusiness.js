const Posts = require('../models/').Posts,
    PostDetails = require('../models/').PostDetails,
    Comments = require('../models/').Comments,
    Rates = require('../models/').Rates,
    Users = require('../models').Users,
    cache = require('../config/cache.js'),
    { POST_MODEL, CACHE, columns } = require('../config/constants'),
    config = require('../config/config.js')[process.env.NODE_ENV];

function getAllPostsInfo() {
    return Posts.findAll({
        include: [{
            model: Users,
            attributes: ['Name']
        }, {
            model: PostDetails
        }, {
            model: Rates
        }]
    });
};

function getProfileInfo() {
    function createResponseOptions(result) {
        return {
            myPostsCollection: getCurrentUsersPosts(result), //methods are almost equal. Refactor
            otherPostsCollection: getOtherUsersPosts(result)
        }
    };

    return new Promise((resolve, reject) => {
        if (config.cache.shouldBeUsed) {
            cache
                .getData()
                .then((result) => {
                    if (!result) {
                        getAllPostsInfo()
                            .then((result) => {
                                cacheUpdate(result);
                                resolve(createResponseOptions(result));
                            });
                    } else {
                        resolve(createResponseOptions(JSON.parse(result)));
                    }
                })
        } else {
            getAllPostsInfo()
                .then((result) => {
                    resolve(createResponseOptions(result));
                });
        }
    });
};

function addPost(title, content) {

    return new Promise((resolve, reject) => {
        Posts.create({
            Title: title,
            Date: new Date(),
            PostDetail: {
                PostBody: content
            }
        }, {
            include: [PostDetails]
        }).then((result) => {
            if (config.cache.shouldBeUsed) {
                getAllPostsInfo()
                    .then((result) => {
                        cacheUpdate(result, resolve);
                    });
            } else {
                resolve();
            }
        }).catch((error) => {
            console.log(error);
        });
    });
};

function getPostById(postId) {
    function createResponseOptionsForThePost(postId, result) {
        let postInfo = getPostInfoById(postId, result);
        return {
            currentPost: {
                id: postId,
                currentUsersRate: isPostRatedByCurrentUser(postId, result),
                averageRate: postInfo[POST_MODEL.POST_RATE],
                Title: postInfo[POST_MODEL.POST_TITLE],
                Name: postInfo[POST_MODEL.POST_AUTHOR],
                Date: new Date(Date.parse(postInfo[POST_MODEL.POST_CREATION_DATE])),
                PostBody: postInfo[POST_MODEL.POST_CONTENT],
                PostDetailID: postInfo[POST_MODEL.POST_DETAIL_ID]
            },
            postComments: getPostCommentsByPostId(postId, result)
        };
    };

    return new Promise((resolve, reject) => {
        if (config.cache.shouldBeUsed) {
            cache
                .getData()
                .then((result) => {
                    if (!result) {
                        getAllPostsInfo()
                            .then((result) => {
                                cacheUpdate(result);
                                resolve(createResponseOptionsForThePost(postId, result));
                            })
                    } else {
                        resolve(createResponseOptionsForThePost(postId, JSON.parse(result)));
                    }
                })
        } else {
            getAllPostsInfo()
                .then((result) => {
                    resolve(createResponseOptionsForThePost(postId, result));
                })
        }
    });
};

function addCommentToThePost(content, ownerId, detailId) {
    return new Promise((resolve, reject) => {
        Comments
            .create({
                CommentContent: content,
                Date: new Date(),
                PostDetailID: detailId, //refactor to check if post detail and owner are exist
                CommentOwnerID: ownerId
            }).then((result) => {
                // CACHE update on comment adding
                if (config.cache.shouldBeUsed) {
                    getAllPostsInfo()
                        .then((result) => {
                            cacheUpdate(result, resolve);
                        });
                } else {
                    resolve();
                }
            });
    });
}

function getPostInfoById(postId, posts) {
    let postInfo = {};
    postInfo[POST_MODEL.POST_TITLE] = null;
    postInfo[POST_MODEL.POST_AUTHOR] = null;
    postInfo[POST_MODEL.POST_CREATION_DATE] = null;

    for (let i = 0; i < posts.length; i++) {
        if (posts[i][columns.BLOG.POSTS.POST_ID] === +postId) {
            postInfo[POST_MODEL.POST_TITLE] = posts[i][columns.BLOG.POSTS.TITLE];
            postInfo[POST_MODEL.POST_AUTHOR] = posts[i].User.Name;
            postInfo[POST_MODEL.POST_CREATION_DATE] = posts[i][columns.BLOG.POSTS.DATE];
            postInfo[POST_MODEL.POST_CONTENT] = posts[i].PostDetail.PostBody;
            postInfo[POST_MODEL.POST_DETAIL_ID] = posts[i].PostDetail.PostDetailID;
            postInfo[POST_MODEL.POST_RATE] = posts[i][POST_MODEL.POST_RATE]; // count average (sum / count)
            break;
        }
    }
    return postInfo;
};

function getPostCommentsByPostId(postId, posts) {
    let currentPostInfo = posts.filter((item) => {
        return (item[POST_MODEL.POST_ID] === +postId && !!item[POST_MODEL.POST_COMMENT_AUTHOR_ID]);
    });

    return currentPostInfo.map((item) => {
        return {
            commentContent: item[POST_MODEL.POST_COMMENT_CONTENT],
            Date: new Date(Date.parse(item[POST_MODEL.POST_COMMENT_CREATION_DATE])),
            Name: item[POST_MODEL.POST_COMMENT_AUTHOR]
        }
    }).sort((a, b) => {
        return (a.Date.getTime() - b.Date.getTime())
    });
};

function isPostRatedByCurrentUser(postId, posts) {
    let isRated = null;
    posts.forEach((item) => {
        if (item[POST_MODEL.POST_ID] === +postId) {
            isRated = !!item[POST_MODEL.CURRENT_USERS_RATE];
        }
    });
    return isRated;
}

function getCurrentUsersPosts(posts) {
    let cachedIds = {},
        currentUsersPosts = posts.filter((item) => {
            if (!cachedIds[JSON.stringify(item[columns.BLOG.POSTS.POST_ID])]) {
                cachedIds[JSON.stringify(item[columns.BLOG.POSTS.POST_ID])] = true;
                return item[columns.BLOG.POSTS.OWNER_ID] === global.User.id;
            }
            return;
        });
    return currentUsersPosts.map((item) => {
        return {
            postId: item[columns.BLOG.POSTS.POST_ID],
            Title: item[columns.BLOG.POSTS.TITLE]
        }
    });
};

function getOtherUsersPosts(posts) {
    let cachedIds = {},
        otherUsersPosts = posts.filter((item) => {
            if (!cachedIds[JSON.stringify(item[columns.BLOG.POSTS.POST_ID])]) {
                cachedIds[JSON.stringify(item[columns.BLOG.POSTS.POST_ID])] = true;
                return item[columns.BLOG.POSTS.OWNER_ID] !== global.User.id;
            }
            return;
        });
    return otherUsersPosts.map((item) => {
        return {
            postId: item[columns.BLOG.POSTS.POST_ID],
            Title: item[columns.BLOG.POSTS.TITLE],
            Name: item[columns.BLOG.USERS.NAME]
        }
    });
};

function setRateToThePost(rating, postId, ownerId) {

    return new Promise((resolve, reject) => {
        Rates
            .create({
                Rate: rating,
                PostID: postId,
                UserID: ownerId
            })
            .then((result) => {
                if (config.cache.shouldBeUsed) {
                    getAllPostsInfo()
                        .then((result) => {
                            cacheUpdate(result, resolve);
                        });
                } else {
                    resolve();
                }
            });
    });
}

function cacheUpdate(result, callback) {
    cache
        .event
        .emit(CACHE.EVENTS.UPDATE_DATA, result, () => {
            if (callback) {
                callback();
            }
        });
}

module.exports = {
    addCommentToThePost: addCommentToThePost,
    addPost: addPost,
    getCurrentUsersPosts: getCurrentUsersPosts,
    getPostById: getPostById,
    getProfileInfo: getProfileInfo,
    setRateToThePost: setRateToThePost
}