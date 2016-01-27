import express from 'express'
import bodyParser from 'body-parser'
import busboy from 'connect-busboy'
import logger from '../utils/logger'
import constraints from '../utils/constraints'
import tmp from 'tmp'
import fs from 'fs'
import gm from 'gm'
import path from 'path'

import Team from '../models/team'
import TeamController from '../controllers/team'
import Validator from 'validator.js'
let validator = new Validator.Validator()
let router = express.Router()
let urlencodedParser = bodyParser.urlencoded({ extended: false })
import errors from '../utils/errors'
import _ from 'underscore'
import is_ from 'is_js'

import sessionMiddleware from '../middleware/session'
import securityMiddleware from '../middleware/security'
import contestMiddleware from '../middleware/contest'

import teamSerializer from '../serializers/team'
import teamTaskProgressSerializer from '../serializers/team-task-progress'

import teamTaskProgressController from '../controllers/team-task-progress'
import teamParam from '../params/team'


router.get('/all', sessionMiddleware.detectScope, (request, response, next) => {
  let onFetch = function(exposeEmail) {
    let serializer = _.partial(teamSerializer, _, { exposeEmail: exposeEmail })
    return (err, teams) => {
      if (err) {
        logger.error(err)
        next(new errors.InternalError())
      } else {
        response.json(_.map(teams, serializer))
      }
    }
  }

  if (request.scope === 'supervisors') {
    TeamController.list(onFetch(true))
  } else {
    TeamController.listQualified(onFetch(false))
  }
})


router.param('teamId', teamParam.id)


router.get('/:teamId/logo', (request, response) => {
  Team.findOne({ _id: request.teamId }, (err, team) => {
    if (team) {
      filename = path.join(process.env.LOGOS_DIR, `team-${request.params.teamId}.png`)
      fs.lstat(filename, (err, stats) => {
        if (err) {
          nologoFilename = path.join(__dirname, '..', '..', 'nologo.png')
          response.sendFile(nologoFilename)
        } else {
          response.sendFile(filename)
        }
      })
    } else {
      if (err) {
        logger.error(err)
      }
      response.status(404).json('Team not found!')
    }
  })
})


router.get('/:teamId/profile', (request, response) => {
  Team.findOne({ _id: request.teamId }, (err, team) => {
    if (team) {
      let result = {
        id: team._id,
        name: team.name,
        country: team.country,
        locality: team.locality,
        institution: team.institution,
        createdAt: team.createdAt.getTime()
      }

      if (request.session.authenticated && ((request.session.role == 'team' && request.session.identityID === team._id) || _.contains(['admin', 'manager'], request.session.role))) {
        result.email = team.email
        result.emailConfirmed = team.emailConfirmed
      }
      response.json(result)
    } else {
      if (err) {
        logger.error(err)
      }
      response.status(404).json('Team not found!')
    }
  })
})


router.post('/verify-email', securityMiddleware.checkToken, urlencodedParser, (request, response, next) => {
  let verifyConstraints = {
    team: constraints.base64url,
    code: constraints.base64url
  }

  let validationResult = validator.validate(request.body, verifyConstraints)
  if (!validationResult) {
    throw new errors.ValidationError()
  }

  TeamController.verifyEmail(request.body.team, request.body.code, (err) => {
    if (err) {
      next(err)
    } else {
      response.json({ success: true })
    }
  })
})


router.post('/reset-password', securityMiddleware.checkToken, sessionMiddleware.needsToBeUnauthorized, urlencodedParser, (request, response, next) => {
  let resetConstraints = {
    team: constraints.base64url,
    code: constraints.base64url,
    password: constraints.password
  }

  let validationResult = validator.validate(request.body, resetConstraints)
  if (!validationResult) {
    throw new errors.ValidationError()
  }

  TeamController.resetPassword(request.body.team, request.body.code, request.body.password, (err) => {
    if (err) {
      next(err)
    } else {
      response.json({ success: true })
    }
  })
})


router.post('/change-password', securityMiddleware.checkToken, sessionMiddleware.needsToBeAuthorizedTeam, urlencodedParser, (request, response, next) => {
  let changeConstraints = {
    currentPassword: constraints.password,
    newPassword: constraints.password
  }

  let validationResult = validator.validate(request.body, changeConstraints)
  if (!validationResult) {
    throw new errors.ValidationError()
  }

  TeamController.changePassword(request.session.identityID, request.body.currentPassword, request.body.newPassword, (err) => {
    if (err) {
      next(err)
    } else {
      response.json({ success: true })
    }
  })
})


router.post('/edit-profile', securityMiddleware.checkToken, sessionMiddleware.needsToBeAuthorizedTeam, urlencodedParser, (request, response, next) => {
  let editConstraints = {
    country: constraints.country,
    locality: constraints.locality,
    institution: constraints.institution
  }

  let validationResult = validator.validate(request.body, editConstraints)
  if (!validationResult) {
    throw new errors.ValidationError()
  }

  TeamController.editProfile(request.session.identityID, request.body.country, request.body.locality, request.body.institution, (err) => {
    if (err) {
      next(err)
    } else {
      response.json({ success: true })
    }
  })
})


router.post('/resend-confirmation-email', securityMiddleware.checkToken, sessionMiddleware.needsToBeAuthorizedTeam, (request, response, next) => {
  TeamController.resendConfirmationEmail(request.session.identityID, (err) => {
    if (err) {
      next(err)
    } else {
      response.json({ success: true })
    }
  })
})


router.post('/change-email', securityMiddleware.checkToken, sessionMiddleware.needsToBeAuthorizedTeam, urlencodedParser, (request, response, next) => {
  let changeConstraints = {
    email: constraints.email
  }

  let validationResult = validator.validate(request.body, changeConstraints)
  if (!validationResult) {
    throw new errors.ValidationError()
  }

  TeamController.changeEmail(request.session.identityID, request.body.email, (err) => {
    if (err) {
      next(err)
    } else {
      response.json({ success: true })
    }
  })
})


router.post('/restore', securityMiddleware.checkToken, sessionMiddleware.needsToBeUnauthorized, urlencodedParser, (request, response, next) => {
  let restoreConstraints = {
    email: constraints.email
  }

  let validationResult = validator.validate(request.body, restoreConstraints)
  if (!validationResult) {
    throw new errors.ValidationError()
  }

  TeamController.restore(request.body.email, (err) => {
    if (err) {
      next(err)
    } else {
      response.json({ success: true })
    }
  })
})


router.post('/signin', securityMiddleware.checkToken, sessionMiddleware.needsToBeUnauthorized, urlencodedParser, (request, response, next) => {
  let signinConstraints = {
    team: constraints.team,
    password: constraints.password
  }

  let validationResult = validator.validate(request.body, signinConstraints)
  if (!validationResult) {
    throw new errors.ValidationError()
  }

  TeamController.signin(request.body.team, request.body.password, (err, team) => {
    if (err) {
      next(err)
    } else {
      request.session.authenticated = true
      request.session.identityID = team._id
      request.session.role = 'team'
      response.json({ success: true })
    }
  })
})


let multidataParser = busboy({
  immediate: true,
  limits: {
    fieldSize: 200,
    fields: 10,
    fileSize: 1 * 1024 * 1024,
    files: 1
  }
})


router.post('/upload-logo', securityMiddleware.checkToken, sessionMiddleware.needsToBeAuthorizedTeam, multidataParser, (request, response, next) => {
  let teamLogo = tmp.fileSync()

  request.busboy.on('file', (fieldName, file, filename, encoding, mimetype) => {
    file.on('data', (data) => {
      if (fieldName === 'logo') {
        fs.appendFileSync(teamLogo.name, data)
      }
    })
  })

  request.busboy.on('finish', () => {
    gm(teamLogo.name).size((err, size) => {
      if (err) {
        logger.error(err)
        next(new errors.InvalidImageError())
      } else {
        if (size.width < 48) {
          next(new errors.ImageDimensionsError())
        } else if (size.width != size.height) {
          next(new errors.ImageAspectRatioError())
        } else {
          TeamController.changeLogo(request.session.identityID, teamLogo.name, (err) => {
            if (err) {
              next(err)
            } else {
              response.json({ success: true })
            }
          })
        }
      }
    })
  })
})


router.post('/signup', contestMiddleware.contestNotFinished, securityMiddleware.checkToken, sessionMiddleware.needsToBeUnauthorized, multidataParser, (request, response, next) => {
  let teamInfo = {}
  let teamLogo = tmp.fileSync()

  request.busboy.on('file', (fieldName, file, filename, encoding, mimetype) => {
    file.on('data', (data) => {
      if (fieldName === 'logo') {
        fs.appendFileSync(teamLogo.name, data)
        teamInfo['logoFilename'] = teamLogo.name
      }
    })
  })

  request.busboy.on('field', (fieldName, val, fieldNameTruncated, valTruncated) => {
    teamInfo[fieldName] = val
  })

  request.busboy.on('finish', () => {
    let signupConstraints = {
      team: constraints.team,
      email: constraints.email,
      password: constraints.password,
      country: constraints.country,
      locality: constraints.locality,
      institution: constraints.institution
    }

    let validationResult = validator.validate(teamInfo, signupConstraints)
    if (validationResult) {
      gm(teamLogo.name).size((err, size) => {
        if (err) {
          logger.error(err)
          next(new errors.InvalidImageError())
        } else {
          if (size.width < 48) {
            next(new errors.ImageDimensionsError())
          } else if (size.width != size.height) {
            next(new errors.ImageAspectRatioError())
          } else {
            TeamController.create(teamInfo, (err, team) => {
              if (err) {
                next(err)
              } else {
                response.json({ success: true })
              }
            })
          }
        }
      })
    } else {
      next(new errors.ValidationError())
    }
  })
})


export default router
