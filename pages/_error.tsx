import { NextPageContext } from 'next'
import Error from 'next/error'

interface ErrorProps {
  statusCode: number
}

function ErrorPage({ statusCode }: ErrorProps) {
  return <Error statusCode={statusCode} />
}

ErrorPage.getInitialProps = ({ res, err }: NextPageContext) => {
  const statusCode = res ? res.statusCode : err ? err.statusCode : 404
  return { statusCode: statusCode || 404 }
}

export default ErrorPage

