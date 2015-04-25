express = require 'express'
_ = require 'underscore'
is_ = require 'is_js'
router = express.Router()

TaskCategoryController = require '../controllers/task-category'
taskCategorySerializer = require '../serializers/task-category'

securityMiddleware = require '../middleware/security'
sessionMiddleware = require '../middleware/session'
contestMiddleware = require '../middleware/contest'

Validator = require 'validator.js'
validator = new Validator.Validator()
constraints = require '../utils/constraints'

bodyParser = require 'body-parser'
urlencodedParser = bodyParser.urlencoded extended: no

taskCategoryParam = require '../params/task-category'


router.get '/all', (request, response, next) ->
    TaskCategoryController.list (err, taskCategories) ->
        if err?
            next err
        else
            response.json _.map taskCategories, taskCategorySerializer

router.post '/create', contestMiddleware.contestNotFinished, securityMiddleware.checkToken, sessionMiddleware.needsToBeAuthorizedAdmin, urlencodedParser, (request, response, next) ->
    createConstraints =
        title: constraints.taskCategoryTitle
        description: constraints.taskCategoryDescription

    validationResult = validator.validate request.body, createConstraints
    unless validationResult is true
        throw new errors.ValidationError()

    TaskCategoryController.create request.body.title, request.body.description, (err, taskCategory) ->
        if err?
            next err
        else
            response.json success: yes


router.param 'taskCategoryId', taskCategoryParam.id


router.post '/:taskCategoryId/remove', contestMiddleware.contestNotFinished, securityMiddleware.checkToken, sessionMiddleware.needsToBeAuthorizedAdmin, (request, response, next) ->
    TaskCategoryController.remove request.taskCategoryId, (err) ->
        if err?
            next err
        else
            response.json success: yes


router.post '/:taskCategoryId/update', contestMiddleware.contestNotFinished, securityMiddleware.checkToken, sessionMiddleware.needsToBeAuthorizedAdmin, urlencodedParser, (request, response, next) ->
    updateConstraints =
        title: constraints.taskCategoryTitle
        description: constraints.taskCategoryDescription

    validationResult = validator.validate request.body, updateConstraints
    unless validationResult is true
        throw new errors.ValidationError()

    TaskCategoryController.update request.taskCategoryId, request.body.title, request.body.description, (err, post) ->
        if err?
            next err
        else
            response.json success: yes

module.exports = router
