const axios = require('axios')
const GitHub = require('github-api')
const moment = require('moment')

const GET_UP_ISSUE_NUMBER = 1
const SENTENCE_API = 'https://v1.jinrishici.com/all'
let DEFAULT_SENTENCE =
  '赏花归去马如飞\r\n去马如飞酒力微\r\n酒力微醒时已暮\r\n醒时已暮赏花归\r\n'
let errMessage = ''
// 获取命令行参数
const args = process.argv.slice(2)

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
  return `今天的起床时间是--${getUpTime}.\r\n\r\n 今天天气--${args[1]}\r\n\r\n 起床啦，读读书，去玩耍，争取跑个步。\r\n\r\n 今天的一句诗:\r\n ${sentence}`
}

const getIssues = async (gitToken) => {
  const oauthAuth = new GitHub({ token: gitToken })
  return await oauthAuth.getIssues('luckelectricity', 'get_up')
}

// 判断是不是今天第一条，是的话创建，不是的话就拜拜
// 在判断是不是在5--8点之前，谁能想九点也算早起了呢。。。
const todayGetUpState = async (getIss) => {
  const issuesInfo = await getIss.listIssueComments(GET_UP_ISSUE_NUMBER)
  if (issuesInfo.statusText === 'OK') {
    const lastComment = issuesInfo.data[issuesInfo.data.length - 1]
    const momentUpdate = moment(lastComment.updated_at).utcOffset(8)
    const momentNew = moment().utcOffset(8)
    const nowHour = momentNew.hour()
    console.log(nowHour)
    if (momentUpdate.isSame(momentNew, 'day')) {
      console.log('今天已经提交过了')
      errMessage = '今天已经提交过了'
      return false
    }
    if (nowHour >= 5 && nowHour <= 8) {
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
  const issuesInfo = await getIss.createIssueComment(
    GET_UP_ISSUE_NUMBER,
    issuesBody
  )
}

init()
