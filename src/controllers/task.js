import Task from '../models/task'

import logger from '../utils/logger'
import { InternalError, DuplicateTaskTitleError, TaskAlreadyOpenedError, TaskClosedError, TaskNotOpenedError, TaskAlreadyClosedError, TaskNotFoundError } from '../utils/errors'
import constants from '../utils/constants'
import publish from '../utils/publisher'

import _ from 'underscore'
import BaseEvent from '../utils/events'

import taskSerializer from '../serializers/task'


class CreateTaskEvent extends BaseEvent {
  constructor(task) {
    super('createTask')
    let taskData = taskSerializer(task, { preview: true })
    this.data.supervisors = taskData
  }
}


class UpdateTaskEvent extends BaseEvent {
  constructor(task) {
    super('updateTask')
    let taskData = taskSerializer(task, { preview: true })
    this.data.supervisors = taskData
    if (!task.isInitial()) {
      this.data.teams = taskData
      this.data.guests = taskData
    }
  }
}


class OpenTaskEvent extends BaseEvent {
  constructor(task) {
    super('openTask')
    let taskData = taskSerializer(task, { preview: true })
    this.data.supervisors = taskData
    this.data.teams = taskData
    this.data.guests = taskData
  }
}


class CloseTaskEvent extends BaseEvent {
  constructor(task) {
    super('closeTask')
    let taskData = taskSerializer(task, { preview: true })
    this.data.supervisors = taskData
    this.data.teams = taskData
    this.data.guests = taskData
  }
}


class TaskController {
  static create(options, callback) {
    Task
      .query()
      .where('title', options.title)
      .first()
      .then((task) => {
        if (task) {
          callback(new DuplicateTaskTitleError(), null)
        } else {
          let now = new Date()

          Task
            .query()
            .insert({
              title: options.title,
              description: options.description,
              createdAt: now,
              updatedAt: now,
              hints: JSON.stringify(options.hints),
              value: options.value,
              categories: JSON.stringify(options.categories),
              answers: JSON.stringify(options.answers),
              caseSensitive: options.caseSensitive,
              state: constants.TASK_INITIAL
            })
            .then((task) => {
              callback(null, task)
              publish('realtime', new CreateTaskEvent(task))
            })
            .catch((err) => {
              logger.error(err)
              callback(new InternalError(), null)
            })
        }
      })
      .catch((err) => {
        logger.error(err)
        callback(new InternalError(), null)
      })
  }

  static update(task, options, callback) {
    Task
      .query()
      .patchAndFetchById(task.id, {
        description: options.description,
        categories: JSON.stringify(options.categories),
        hints: JSON.stringify(options.hints),
        answers: JSON.stringify(_.union(task.answers, options.answers)),
        updatedAt: new Date()
      })
      .then((updatedTask) => {
        callback(null, updatedTask)
        publish('realtime', new UpdateTaskEvent(updatedTask))
      })
      .catch((err) => {
        logger.error(err)
        callback(new InternalError(), null)
      })
  }

  static list(callback) {
    Task
      .query()
      .then((tasks) => {
        callback(null, tasks)
      })
      .catch((err) => {
        logger.error(err)
        callback(new InternalError(), null)
      })
  }

  static listEligible(callback) {
    Task
      .query()
      .where('state', constants.TASK_OPENED)
      .orWhere('state', constants.TASK_CLOSED)
      .then((tasks) => {
        callback(null, tasks)
      })
      .catch((err) => {
        logger.error(err)
        callback(new InternalError(), null)
      })
  }

  static checkAnswer(task, proposedAnswer, callback) {
    if (!task.caseSensitive) {
      proposedAnswer = proposedAnswer.toLowerCase()
    }

    let answerCorrect = false
    for (let answer of task.answers) {
      if (task.caseSensitive) {
        answerCorrect = (proposedAnswer === answer)
      } else {
        answerCorrect = (proposedAnswer == answer.toLowerCase())
      }
      if (answerCorrect) {
        break
      }
    }

    callback(null, answerCorrect)
  }

  static open(task, callback) {
    if (task.isInitial()) {
      Task
        .query()
        .patchAndFetchById(task.id, {
          state: constants.TASK_OPENED,
          updatedAt: new Date()
        })
        .then((updatedTask) => {
          callback(null)
          publish('realtime', new OpenTaskEvent(updatedTask))
        })
        .catch((err) => {
          logger.error(err)
          callback(new InternalError())
        })
    } else {
      if (task.isOpened()) {
        callback(new TaskAlreadyOpenedError())
      } else if (task.isClosed()) {
        callback(new TaskClosedError())
      } else {
        callback(new InternalError())
      }
    }
  }

  static close(task, callback) {
    if (task.isOpened()) {
      Task
        .query()
        .patchAndFetchById(task.id, {
          state: constants.TASK_CLOSED,
          updatedAt: new Date()
        })
        .then((updatedTask) => {
          callback(null)
          publish('realtime', new CloseTaskEvent(updatedTask))
        })
        .catch((err) => {
          logger.error(err)
          callback(new InternalError())
        })
    } else {
      if (task.isInitial()) {
        callback(new TaskNotOpenedError())
      } else if (task.isClosed()) {
        callback(new TaskAlreadyClosedError())
      } else {
        callback(new InternalError())
      }
    }
  }

  static get(id, callback) {
    Task
      .query()
      .where('id', id)
      .first()
      .then((task) => {
        if (task) {
          callback(null, task)
        } else {
          callback(new TaskNotFoundError())
        }
      })
      .catch((err) => {
        logger.error(err)
        callback(new InternalError(), null)
      })
  }

  static getByCategory(categoryId, callback) {
    Task
      .query()
      .then((tasks) => {
        callback(null, _.filter(tasks, (task) => {
          return _.contains(task.categories, categoryId)
        }))
      })
      .catch((err) => {
        logger.error(err)
        callback(new InternalError(), null)
      })
  }
}


export default TaskController
