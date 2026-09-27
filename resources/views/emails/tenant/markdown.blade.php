@component('mail::message')
@if($logo)
<img src="{{ \Illuminate\Support\Facades\Storage::disk('s3')->url($logo) }}" alt="{{ $tenantName }}" style="max-height:64px">
@endif

{!! \Illuminate\Support\Str::markdown($markdown) !!}

Thanks,<br>
{{ $tenantName }}
@endcomponent
