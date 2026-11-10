import React, { useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import QuestionsApp from './src/QuestionsApp.jsx'
import './src/styles/global.css'

const channel = 'blink.onboarding.school'
const id = new URLSearchParams(location.search).get('id')
const school = schools.find(item => item.id === id)
const origin = location.protocol === 'file:' ? 'null' : location.origin

function notify(type, payload = {}) {
  parent.postMessage({ channel, id, type, ...payload }, origin === 'null' ? '*' : origin)
}

function EmbeddedSchool() {
  const [schoolState, setSchoolState] = useState(null)
  useEffect(() => {
    const receive = event => {
      const data = event.data
      if (event.source !== parent || event.origin !== origin || data?.channel !== channel || data.id !== id) return
      if (data.type === 'state') setSchoolState(data)
      if (data.type === 'back') window.dispatchEvent(new Event('school-back'))
    }
    window.addEventListener('message', receive)
    notify('ready')
    return () => window.removeEventListener('message', receive)
  }, [])
  if (!school || !schoolState) return null
  return <QuestionsApp school={school} joined={schoolState.joined} initialRequests={schoolState.requestIds}
    onRequestChange={(studentId, pending) => notify('requestChanged', { studentId, pending })}
    onJoin={() => notify('joined')}
    onContinue={() => notify('continue')} onClose={() => notify('close')} />
}

createRoot(document.getElementById('root')).render(<EmbeddedSchool />)
