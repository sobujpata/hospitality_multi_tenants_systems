<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>{{ $subjectLine ?? 'Platform announcement' }}</title>
</head>
<body>
    <main>
        {!! nl2br(e($bodyText)) !!}
    </main>
</body>
</html>
