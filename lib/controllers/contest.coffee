_ = require 'underscore'

Contest = require '../models/contest'
TeamScore = require '../models/team-score'
TaskCategory = require '../models/task-category'

TeamController = require '../controllers/team'

errors = require '../utils/errors'
constants = require '../utils/constants'
logger = require '../utils/logger'

publisher = require '../utils/publisher'
BaseEvent = require('../utils/events').BaseEvent

contestSerializer = require '../serializers/contest'


class UpdateContestEvent extends BaseEvent
    constructor: (contest) ->
        super 'updateContest'
        contestData = contestSerializer contest
        @data.supervisors = contestData
        @data.teams = contestData
        @data.guests = contest


class ContestController
    @get: (callback) ->
        Contest.findOne {}, (err, contest) ->
            if err?
                logger.error err
                callback new errors.ContestNotInitializedError(), null
            else
                # Warning: this can be null. This is a normal situation.
                callback null, contest

    @getScores: (callback) ->
        TeamController.listQualified (err, teams) ->
            if err?
                callback err, null
            else
                TeamScore.find {}, (err, teamScores) ->
                    if err?
                        callback err, null
                    else
                        result = _.map teams, (team) ->
                            teamScore = _.findWhere teamScores, team: team.id
                            unless teamScore?
                                teamScore =
                                    team: team._id
                                    score: 0
                                    updatedAt: null

                            return teamScore

                        callback null, result

    @update: (state, startsAt, finishesAt, callback) ->
        ContestController.get (err, contest) ->
            if err?
                callback err, null
            else
                if state is constants.CONTEST_INITIAL
                    if contest? and contest.state != state
                        TaskCategory.remove {}, (err) ->
                            if err?
                                logger.error err
                                callback new errors.InternalError(), null
                                return

                if contest?
                    contest.state = state
                    contest.startsAt = startsAt
                    contest.finishesAt = finishesAt
                else
                    contest = new Contest
                        state: state
                        startsAt: startsAt
                        finishesAt: finishesAt

                contest.save (err, contest) ->
                    if err?
                        logger.error err
                        callback new errors.InternalError(), null
                    else
                        callback null, contest

                        publisher.publish 'realtime', new UpdateContestEvent contest


module.exports = ContestController
