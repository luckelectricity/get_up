// const axios = require('axios')
// const GitHub = require('github-api')
// const moment = require('moment')

// 把这三个改成import
import axios from 'axios'
import GitHub from 'github-api'
import moment from 'moment'
import fetch from 'node-fetch'

import BingImageCreator from './bingImageCreator.js'
import { SENTENCE_API, GET_UP_ISSUE_NUMBER } from './const.js'

let DEFAULT_SENTENCE = '赏花归去马如飞\r\n去马如飞酒力微\r\n酒力微醒时已暮\r\n醒时已暮赏花归\r\n'
let errMessage = ''
// 获取命令行参数
const args = process.argv.slice(3)

const getSHiCi = async () => {
  let res = await axios.get(SENTENCE_API)
  if (res.status === 200) {
    return res.data.content
  }
  return DEFAULT_SENTENCE
}

const createIssuesBody = async () => {
  let sentence = await getSHiCi()
  const getUpTime = moment().utcOffset(8).format('YYYY-MM-DD HH:mm:ss')
  return `今天的起床时间是--${getUpTime}.\r\n\r\n 今天天气--${args[2]}\r\n\r\n 起床啦，读读书，去玩耍，争取跑个步。\r\n\r\n 今天的一句诗:\r\n ${sentence}`
}

const getIssues = async gitToken => {
  const oauthAuth = new GitHub({ token: gitToken })
  return await oauthAuth.getIssues('luckelectricity', 'get_up')
}

// 调用BingImageCreator
const createImages = async () => {
  const bingImageCreator = new BingImageCreator({
    cookie: args[1] || ''
  })

  const images = await bingImageCreator.createImage(DEFAULT_SENTENCE)
  return images
}

const saveImages = async () => {
  try {
    const res = await createImages()
    console.log('Create Successful: ', res)

    const imagesPath = path.join(cwd, 'images')
    if (!fs.existsSync(imagesPath)) {
      fs.mkdirSync(imagesPath)
    }

    // 在 images 目录下，创建一个以年月日命名的文件夹，将图片放入其中
    const imagesFolderName = moment().format('YYYY-MM-DD')
    const imagesFolderPath = path.join(imagesPath, imagesFolderName)
    if (!fs.existsSync(imagesFolderPath)) {
      fs.mkdirSync(imagesFolderPath)
    }

    // 将图片放入 images 目录下的文件夹中
    res.images.forEach((image, index) => {
      // images 中是网络url，请求图片，将图片保存到 images 目录下的文件夹中
      const imageFileName = `${index}.jpg`
      const imageFilePath = path.join(imagesFolderPath, imageFileName)

      // 下载图片
      fetch(image).then(res => {
        if (!res.ok) throw new Error(`unexpected response ${res.statusText}`)
        // @ts-ignore
        pipeline(res.body, fs.createWriteStream(imageFilePath)).catch(e => {
          console.error('Something went wrong while saving the image', e)
        })
      })
    })
    const options = { timeZone: 'Asia/Shanghai', hour12: false }
    const outputData = {
      ...res,
      date: new Date().toLocaleString('zh-CN', options),
      localImagesPath: imagesFolderName
    }

    const contentPath = path.join(cwd, 'website/src/content/images')

    const contentFile = path.join(contentPath, `${imagesFolderName}.json`)

    fs.writeFileSync(contentFile, JSON.stringify(outputData))

    setTimeout(() => {
      // 为了让图片下载完毕，再退出进程
      process.exit(0)
    }, 5000)
  } catch (e) {
    console.error(e)
    process.exit(1)
  }
}

// 判断是不是今天第一条，是的话创建，不是的话就拜拜
// 在判断是不是在5--8点之前，谁能想九点也算早起了呢。。。
const todayGetUpState = async getIss => {
  const issuesInfo = await getIss.listIssueComments(GET_UP_ISSUE_NUMBER)
  if (issuesInfo.statusText === 'OK') {
    const lastComment = issuesInfo.data[issuesInfo.data.length - 1]
    const momentUpdate = moment(lastComment.updated_at).utcOffset(8)
    const momentNew = moment().utcOffset(8)
    const nowHour = momentNew.hour()
    console.log('现在是xx小时', nowHour)
    if (momentUpdate.isSame(momentNew, 'day')) {
      console.log('今天已经提交过了')
      errMessage = '今天已经提交过了'
      return false
    }
    if (nowHour < 5 || nowHour > 8) {
      console.log('只有五点到九点之间能提交')
      errMessage = '只有五点到九点之间能提交'
      return false
    }
    return true
  }
  return false
}

const init = async () => {
  const issuesBody = await createIssuesBody()
  const getIss = await getIssues(args[0])
  const todayStatus = await todayGetUpState(getIss)
  if (!todayStatus) {
    console.log(errMessage)
    return errMessage
  }
  const issuesInfo = await getIss.createIssueComment(GET_UP_ISSUE_NUMBER, issuesBody)
}

// init()
saveImages()
