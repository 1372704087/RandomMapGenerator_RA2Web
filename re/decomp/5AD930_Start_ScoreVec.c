// 0x5ad930 Start_ScoreVec size=86

char __thiscall sub_5AD930(int this, int a2)
{
  char *v3; // edi
  int i; // ecx
  int v5; // eax
  _DWORD *v6; // edx
  int v7; // eax

  if ( a2 < 0 )
    return 0;
  v3 = (char *)operator new(8 * (a2 + *(_DWORD *)(this + 8)));
  if ( v3 == nullptr )
    return 0;
  for ( i = 0; i < *(_DWORD *)(this + 4); *(_DWORD *)&v3[v5 + 4] = v6[1] )
  {
    v5 = 8 * i;
    v6 = (_DWORD *)(*(_DWORD *)this + 8 * i++);
    *(_DWORD *)&v3[v5] = *v6;
  }
  operator delete(*(void **)this);
  v7 = a2 + *(_DWORD *)(this + 8);
  *(_DWORD *)this = v3;
  *(_DWORD *)(this + 8) = v7;
  *(_DWORD *)(this + 16) = 0;
  return 1;
}
